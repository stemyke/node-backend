import {DependencyContainer, inject, injectable, injectAll, Lifecycle, scoped} from "tsyringe";
import {schedule, validate} from "node-cron";
import {socket, Socket} from "zeromq";
import {Subject, Subscription} from "rxjs";
import {filter, map} from "rxjs/operators";
import {ObjectId} from "bson";
import {
    DI_CONTAINER,
    IJob,
    IJobTask,
    IMessageBridge,
    ISocketMessage,
    JOB,
    JobParams,
    JobScheduleRange,
    JobScheduleTime,
    SocketParams,
    Type
} from "../common-types";
import {
    colorize,
    ConsoleColor,
    getConstructorName,
    isArray,
    isObject,
    jsonHighlight,
    MAX_TIMEOUT,
    promiseTimeout
} from "../utils";
import {Configuration} from "./configuration";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class JobManager {

    protected jobTypes: Type<IJob>[];
    protected jobs: {[name: string]: (jobParams: JobParams) => Promise<any>};
    protected messages: Subject<ISocketMessage>;
    protected messageBridge: IMessageBridge;
    protected processing: boolean;

    protected apiPush: Socket;
    protected apiPull: Socket;
    protected workerPush: Socket;
    protected workerPull: Socket;

    constructor(readonly config: Configuration, @inject(DI_CONTAINER) readonly container: DependencyContainer, @injectAll(JOB) jobTypes: Type<IJob>[]) {
        this.jobTypes = jobTypes || [];
        this.jobs = this.jobTypes.reduce((res, jobType) => {
            res[getConstructorName(jobType)] = (jobParams: JobParams) => {
                const job = this.resolveJobInstance(jobType, jobParams);
                return job.process(this.messageBridge);
            }
            return res;
        }, {});
        this.messages = new Subject<ISocketMessage>();
        this.messageBridge = {
            sendMessage: (message: string, params?: SocketParams) => {
                this.workerPush.send([message, JSON.stringify(params)]);
            }
        };
        this.processing = false;
    }

    on(message: string, cb: (params: SocketParams) => any): Subscription {
        return this.messages
            .pipe(filter(t => t.message === message))
            .pipe(map(t => t.params)).subscribe(cb);
    }

    async process(jobType: Type<IJob>, params: JobParams = {}): Promise<any> {
        let instance: IJob = null;
        try {
            instance = this.resolveJobInstance(jobType, params);
        } catch (e) {
            const jobName = getConstructorName(jobType);
            throw `Can't resolve params for job: ${jobName}, with params: ${JSON.stringify(params)}. Reason: ${e}`;
        }
        return instance.process();
    }

    async enqueueWithName(name: string, params: JobParams = {}): Promise<any> {
        return this.sendToWorkers(this.tryResolveFromName(name, params), params);
    }

    async enqueue(jobType: Type<IJob>, params: JobParams = {}): Promise<any> {
        return this.sendToWorkers(this.tryResolveAndInit(jobType, params), params);
    }

    schedule(minute: JobScheduleTime, hour: JobScheduleTime, dayOfMonth: JobScheduleTime, month: JobScheduleTime, dayOfWeek: JobScheduleTime, jobType: Type<IJob>, params: JobParams = {}): IJobTask {
        const expression = [minute, hour, dayOfMonth, month, dayOfWeek].map(t => {
            if (isObject(t)) {
                const range = t as JobScheduleRange;
                return `${range.min || 0}-${range.max || 0}`;
            }
            if (isArray(t)) {
                return t.join(",");
            }
            return `${t}`;
        }).join(" ");
        const jobName = getConstructorName(jobType);
        if (!validate(expression)) {
            console.log(`Can't schedule the task: '${jobName}' because time expression is invalid.`);
            return null;
        }
        return schedule(expression, () => {
            this.enqueue(jobType, params).catch(e => {
                console.log(`Can't enqueue job: '${jobName}' because: ${e}`);
            });
        });
    }

    async startProcessing(): Promise<any> {
        if (this.processing) return null;
        this.processing = true;

        if (!this.config.resolve("isWorker")) {
            console.log(colorize(`Processing can not be started because this is NOT a worker process!`, ConsoleColor.FgRed));
            return null;
        }

        const host = this.config.resolve("zmqRemoteHost");
        const pushHost = `${host}:${this.config.resolve("zmqBackPort")}`;
        this.workerPush = socket("push");
        await this.workerPush.connect(pushHost);
        console.log(`Worker producer connected to: ${pushHost}`);

        const pullHost = `${host}:${this.config.resolve("zmqPort")}`;
        this.workerPull = socket("pull");
        await this.workerPull.connect(pullHost);
        console.log(`Worker consumer connected to: ${pullHost}`);

        this.workerPull.on("message", async (name: Buffer, args: Buffer, uniqueId: Buffer) => {
            try {
                const jobName = name.toString("utf8");
                const jobParams = JSON.parse(args.toString("utf8")) as JobParams;
                const timerId = uniqueId?.toString("utf8");

                console.time(timerId);
                console.timeLog(timerId, `Started working on background job: ${colorize(jobName, ConsoleColor.FgCyan)} with args: \n${jsonHighlight(jobParams)}\n\n`);

                this.messageBridge.sendMessage(`job-started`, {name: jobName});
                try {
                    await Promise.race([this.jobs[jobName](jobParams), promiseTimeout(MAX_TIMEOUT, true)]);
                    console.timeLog(timerId, `Finished working on background job: ${colorize(jobName, ConsoleColor.FgCyan)}\n\n`);
                } catch (e) {
                    console.timeLog(timerId, `Background job failed: ${colorize(jobName, ConsoleColor.FgRed)}\n${e}\n\n`);
                }
                console.timeEnd(timerId);
            } catch (e) {
                console.log(`Failed to start job: ${e.message}`);
            }
        });
    }

    tryResolve(jobType: Type<IJob>, params: JobParams): string {
        const jobName = getConstructorName(jobType);
        if (!this.jobs[jobName]) {
            throw `Can't find job with name: ${jobName} so it can't be enqueued!`;
        }
        try {
            this.resolveJobInstance(jobType, params);
        } catch (e) {
            throw `Can't resolve params for job: ${jobName}, with params: ${JSON.stringify(params)}. Reason: ${e}`;
        }
        return jobName;
    }

    protected tryResolveFromName(jobName: string, params: JobParams): string {
        const jobType = this.jobTypes.find(type => {
            return getConstructorName(type) == jobName;
        });
        if (!jobType) {
            throw `Can't find job type with name: ${jobName} so it can't be enqueued!`;
        }
        return this.tryResolveAndInit(jobType, params);
    }

    protected tryResolveAndInit(jobType: Type<IJob>, params: JobParams): string {
        if (!this.apiPush) {
            const port = this.config.resolve("zmqPort");
            this.apiPush = socket("push");
            this.apiPush.bind(`tcp://0.0.0.0:${port}`);
            console.log(`API producer bound to port: ${port}`);
        }
        if (!this.apiPull) {
            const backPort = this.config.resolve("zmqBackPort");
            this.apiPull = socket("pull");
            this.apiPull.bind(`tcp://0.0.0.0:${backPort}`);
            this.apiPull.on("message", (name: Buffer, args?: Buffer) => {
                const message = name.toString("utf8");
                const params = JSON.parse(args?.toString("utf8") || "{}") as JobParams;
                console.log(`Received a message from worker: "${colorize(message, ConsoleColor.FgCyan)}" with args: ${jsonHighlight(params)}\n\n`);
                this.messages.next({message, params});
            });
            console.log(`API consumer bound to port: ${backPort}`);
        }
        return this.tryResolve(jobType, params);
    }

    protected resolveJobInstance(jobType: Type<IJob>, params: JobParams): IJob {
        const container = this.container.createChildContainer();
        Object.keys(params).map((name) => {
            container.register(name, {useValue: params[name]});
        });
        container.register(jobType, jobType);
        return container.resolve(jobType) as IJob;
    }

    protected async sendToWorkers(jobName: string, params: JobParams): Promise<any> {
        const publisher = await this.apiPush;
        await publisher.send([jobName, JSON.stringify(params), new ObjectId().toHexString()]);
    }
}
