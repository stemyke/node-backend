import {DependencyContainer, inject, injectAll, singleton} from "tsyringe";
import cron from "node-cron";
import {socket, Socket} from "zeromq/v5-compat";
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
    getType,
    isArray,
    isObject,
    jsonHighlight,
    promiseTimeout
} from "../utils";
import {Configuration} from "./configuration";
import {Logger} from "./logger";

@singleton()
export class JobManager {

    protected jobTypes: Type<IJob>[];
    protected jobs: { [name: string]: (jobParams: JobParams, uniqueId: string) => Promise<any> };
    protected messages: Subject<ISocketMessage>;

    protected apiPush: Promise<Socket>;
    protected apiPull: Promise<Socket>;
    protected workerPush: Promise<Socket>;
    protected workerPull: Promise<Socket>;

    readonly maxTimeout: number;

    constructor(readonly config: Configuration,
                readonly logger: Logger,
                @inject(DI_CONTAINER) readonly container: DependencyContainer,
                @injectAll(JOB) jobTypes: Type<IJob>[]) {
        this.jobTypes = jobTypes || [];
        this.jobs = this.jobTypes.reduce((res, jobType) => {
            const jobName = getConstructorName(jobType);
            res[jobName] = (jobParams: JobParams, uniqueId: string) => {
                const job = this.resolveJobInstance(jobType, jobParams, uniqueId);
                const messageBridge: IMessageBridge = {
                    sendMessage: (message: string, params?: SocketParams) => {
                        params.uniqueId = uniqueId;
                        this.workerPush.then(sock => {
                            sock.send([message, JSON.stringify(params)]);
                        });
                    }
                };
                messageBridge.sendMessage(`job-started`, {name: jobName});
                return job.process(messageBridge);
            }
            return res;
        }, {});
        this.messages = new Subject<ISocketMessage>();
        this.maxTimeout = this.config.resolve("jobTimeout");
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
            throw new Error(`Can't resolve params for job: ${jobName}, with params: ${JSON.stringify(params)}. Reason: ${e}`);
        }
        return instance.process();
    }

    async enqueueWithName(name: string, params: JobParams = {}): Promise<string> {
        return this.sendToWorkers(this.tryResolveFromName(name, params), params);
    }

    async enqueue(jobType: Type<IJob>, params: JobParams = {}): Promise<string> {
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
        if (!cron.validate(expression)) {
            this.logger.log("job-manager", `Can't schedule the task: '${jobName}' because time expression is invalid.`);
            return null;
        }
        return cron.schedule(expression, () => {
            this.enqueue(jobType, params).catch(e => {
                this.logger.log("job-manager", `Can't enqueue job: '${jobName}' because: ${e}`);
            });
        });
    }

    async startProcessing(): Promise<void> {
        const host = this.config.resolve("zmqRemoteHost");
        const pushHost = `${host}:${this.config.resolve("zmqBackPort")}`;
        const pullHost = `${host}:${this.config.resolve("zmqPort")}`;
        this.workerPush = this.workerPush || new Promise(resolve => {
            const sock = socket("push");
            sock.connect(pushHost);
            this.logger.log("job-manager", `Worker producer connected to: ${pushHost}`);
            resolve(sock);
        });
        this.workerPull = this.workerPull || new Promise(resolve => {
            const sock = socket("pull");
            sock.connect(pullHost);
            sock.on("message", async (name: Buffer, args: Buffer, uniqId: Buffer) => {
                try {
                    const jobName = name.toString("utf8");
                    const jobParams = JSON.parse(args.toString("utf8")) as JobParams;
                    const uniqueId = uniqId?.toString("utf8");

                    console.time(uniqueId);
                    console.timeLog(uniqueId, `Started working on background job: ${colorize(jobName, ConsoleColor.FgCyan)} with args: \n${jsonHighlight(jobParams)}\n\n`);

                    try {
                        await Promise.race([this.jobs[jobName](jobParams, uniqueId), promiseTimeout(this.maxTimeout, true)]);
                        console.timeLog(uniqueId, `Finished working on background job: ${colorize(jobName, ConsoleColor.FgCyan)}\n\n`);
                    } catch (e) {
                        console.timeLog(uniqueId, `Background job failed: ${colorize(jobName, ConsoleColor.FgRed)}\n${e}\n\n`);
                    }
                    console.timeEnd(uniqueId);
                } catch (e) {
                    this.logger.log("job-manager", `Failed to start job: ${e.message}`);
                }
            });
            this.logger.log("job-manager", `Worker consumer connected to: ${pullHost}`);
            resolve(sock);
        });

        await Promise.allSettled([
            this.workerPush,
            this.workerPull,
        ]);
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

    protected tryResolveFromName(jobName: string, params: JobParams) {
        const jobType = this.jobTypes.find(type => {
            return getConstructorName(type) == jobName;
        });
        if (!jobType) {
            throw `Can't find job type with name: ${jobName} so it can't be enqueued!`;
        }
        return this.tryResolveAndInit(jobType, params);
    }

    protected tryResolveAndInit(jobType: Type<IJob>, params: JobParams) {
        this.apiPush = this.apiPush || new Promise(resolve => {
            const port = this.config.resolve("zmqPort");
            const sock = socket("push");
            sock.bind(`tcp://0.0.0.0:${port}`, () => {
                this.logger.log("job-manager", `API producer bound to port: ${port}`);
                resolve(sock);
            });
        });
        this.apiPull = this.apiPush || new Promise(resolve => {
            const backPort = this.config.resolve("zmqBackPort");
            const sock = socket("pull");
            sock.bind(`tcp://0.0.0.0:${backPort}`, () => {
                sock.on("message", (name: Buffer, args?: Buffer) => {
                    const message = name.toString("utf8");
                    const params = JSON.parse(args?.toString("utf8") || "{}") as JobParams;
                    const paramTypes = Object.keys(params).reduce((res, key) => {
                        res[key] = getType(params[key]);
                        return res;
                    }, {});
                    this.logger.log("job-manager", `Received a message from worker: "${colorize(message, ConsoleColor.FgCyan)}" with args: ${jsonHighlight(paramTypes)}\n\n`);
                    this.messages.next({message, params});
                });
                this.logger.log("job-manager", `API consumer bound to port: ${backPort}`);
                resolve(sock);
            });
        });
        return this.tryResolve(jobType, params);
    }

    protected resolveJobInstance(jobType: Type<IJob>, params: JobParams, uniqueId: string = "") {
        const container = this.container.createChildContainer();
        Object.keys(params).map((name) => {
            container.register(name, {useValue: params[name]});
        });
        container.register("uniqueId", {useValue: uniqueId});
        container.register(jobType, jobType);
        return container.resolve(jobType) as IJob;
    }

    protected async sendToWorkers(jobName: string, params: JobParams) {
        const uniqueId = new ObjectId().toHexString();
        const sock = await this.apiPush;
        sock.send([jobName, JSON.stringify(params), uniqueId]);
        return uniqueId;
    }
}
