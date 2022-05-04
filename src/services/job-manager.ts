import {DependencyContainer, inject, injectable, injectAll, Lifecycle, scoped} from "tsyringe";
import {schedule, validate} from "node-cron";
import {socket, Socket} from "zeromq";
import {ObjectId} from "bson";
import {DI_CONTAINER, IJob, IJobTask, JOB, JobParams, JobScheduleRange, JobScheduleTime, Type} from "../common-types";
import {getConstructorName, isArray, isObject, jsonHighlight, promiseTimeout} from "../utils";
import {Configuration} from "./configuration";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class JobManager {

    protected jobs: {[name: string]: (jobParams: JobParams) => Promise<any>};
    protected scheduler: Promise<Socket>;
    protected worker: Socket;
    protected jobTypes: Type<IJob>[];

    constructor(readonly config: Configuration, @inject(DI_CONTAINER) readonly container: DependencyContainer, @injectAll(JOB) jobTypes: Type<IJob>[]) {
        this.jobTypes = jobTypes || [];
        this.jobs = this.jobTypes.reduce((res, jobType) => {
            res[getConstructorName(jobType)] = (jobParams: JobParams) => {
                const job = this.resolveJobInstance(jobType, jobParams);
                return job.process();
            }
            return res;
        }, {});
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
        const jobName = await this.tryResolveFromName(name, params);
        return this.sendToWorkers(jobName, params);
    }

    async enqueue(jobType: Type<IJob>, params: JobParams = {}): Promise<any> {
        const jobName = await this.tryResolveAndConnect(jobType, params);
        return this.sendToWorkers(jobName, params);
    }

    protected async sendToWorkers(jobName: string, params: JobParams): Promise<any> {
        const publisher = await this.scheduler;
        await publisher.send([jobName, JSON.stringify(params), new ObjectId().toHexString()]);
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

    startProcessing(): void {
        const host = this.config.resolve("zmqRemoteHost");
        this.worker = socket("pull");
        this.worker.connect(host);
        this.worker.on("message", async (name: Buffer, args: Buffer, uniqueId: Buffer) => {
            try {
                const jobName = name.toString("utf8");
                const jobParams = JSON.parse(args.toString("utf8")) as JobParams;
                const timerId = uniqueId?.toString("utf8");
                const jobNameLog = `\x1b[36m"${jobName}"\x1b[0m`;
                const jobArgsLog = `\n${jsonHighlight(jobParams)}`;

                console.time(timerId);
                console.timeLog(timerId, `Started working on background job: ${jobNameLog} with args: ${jobArgsLog}\n\n`);
                try {
                    await Promise.race([this.jobs[jobName](jobParams), promiseTimeout(15000, true)]);
                    console.timeLog(timerId, `Finished working on background job: ${jobNameLog}\n\n`);
                } catch (e) {
                    console.timeLog(timerId, `Background job failed: ${jobNameLog}\n${e.message}\n\n`);
                }
                console.timeEnd(timerId);
            } catch (e) {
                console.log(`Failed to start job: ${e.message}`);
            }
        });
        console.log(`Waiting for jobs at: ${host}`);
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

    protected tryResolveFromName(jobName: string, params: JobParams): Promise<string> {
        const jobType = this.jobTypes.find(type => {
            return getConstructorName(type) == jobName;
        });
        if (!jobType) {
            throw `Can't find job type with name: ${jobName} so it can't be enqueued!`;
        }
        return this.tryResolveAndConnect(jobType, params);
    }

    protected async tryResolveAndConnect(jobType: Type<IJob>, params: JobParams): Promise<string> {
        this.scheduler = this.scheduler || new Promise<any>(async resolve => {
            const port = this.config.resolve("zmqPort");
            const publisher = socket("push");
            await publisher.bind(`tcp://0.0.0.0:${port}`)
            console.log(`Publisher bound to port: ${port}`);
            resolve(publisher);
        });
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
}
