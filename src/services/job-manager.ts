import {DependencyContainer, inject, injectable, injectAll, Lifecycle, scoped} from "tsyringe";
import {Queue, Scheduler, Worker} from "node-resque";
import {schedule, validate} from "node-cron";
import ioredis from "ioredis";
import {DI_CONTAINER, IJob, IJobTask, JOB, JobParams, JobScheduleRange, JobScheduleTime, Type} from "../common-types";
import {getConstructorName, isArray, isObject} from "../utils";
import {Configuration} from "./configuration";

const IORedis = ioredis;

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class JobManager {

    protected jobs: any;
    protected queue: Queue;
    protected worker: Worker;
    protected scheduler: Scheduler;
    protected jobTypes: Type<IJob>[];

    constructor(readonly config: Configuration, @inject(DI_CONTAINER) readonly container: DependencyContainer, @injectAll(JOB) jobTypes: Type<IJob>[]) {
        this.jobTypes = jobTypes || [];
        this.jobs = this.jobTypes.reduce((res, jobType) => {
            res[getConstructorName(jobType)] = {
                perform: this.toPerformFunction(jobType)
            };
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

    async enqueueWithName(name: string, params: JobParams = {}, que: string = "main"): Promise<any> {
        const jobName = await this.tryResolveFromName(name, params);
        await this.queue.enqueue(que, jobName, [params]);
    }

    async enqueue(jobType: Type<IJob>, params: JobParams = {}, que: string = "main"): Promise<any> {
        const jobName = await this.tryResolveAndConnect(jobType, params);
        await this.queue.enqueue(que, jobName, [params]);
    }

    async enqueueAt(timestamp: number, jobType: Type<IJob>, params: JobParams = {}, que: string = "main"): Promise<any> {
        const jobName = await this.tryResolveAndConnect(jobType, params);
        await this.queue.enqueueAt(timestamp, que, jobName, [params]);
    }

    async enqueueIn(time: number, jobType: Type<IJob>, params: JobParams = {}, que: string = "main"): Promise<any> {
        const jobName = await this.tryResolveAndConnect(jobType, params);
        await this.queue.enqueueIn(time, que, jobName, [params]);
    }

    schedule(minute: JobScheduleTime, hour: JobScheduleTime, dayOfMonth: JobScheduleTime, month: JobScheduleTime, dayOfWeek: JobScheduleTime, jobType: Type<IJob>, params: JobParams = {}, que: string = "main"): IJobTask {
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
            this.enqueue(jobType, params, que).catch(e => {
                console.log(`Can't enqueue job: '${jobName}' because: ${e}`);
            });
        });
    }

    async startProcessing(): Promise<any> {
        this.initialize();
        await this.worker.connect();
        await this.worker.start();
        await this.scheduler.connect();
        await this.scheduler.start();
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

    protected initialize(): void {
        if (this.queue) return;
        const config = this.config;
        const options = {password: config.resolve("redisPassword")};
        const sentinels: Array<{host: string, port: number}> = config.resolve("redisSentinels");
        const redis = !sentinels
            ? null
            : new IORedis({
                sentinels,
                name: config.resolve("redisCluster"),
            });
        const connection = {
            pkg: "ioredis",
            host: config.resolve("redisHost"),
            password: options.password,
            port: config.resolve("redisPort"),
            namespace: config.resolve("redisNamespace"),
            redis,
            options
        };
        const queues = config.resolve("workQueues");
        this.queue = new Queue({connection}, this.jobs);
        this.worker = new Worker({connection, queues}, this.jobs);
        this.worker.on("job", (queue, job) => {
            console.log(`working job ${queue} ${JSON.stringify(job)}`);
        });
        this.worker.on("reEnqueue", (queue, job, plugin) => {
            console.log(`reEnqueue job (${plugin}) ${queue} ${JSON.stringify(job)}`);
        });
        this.worker.on("success", (queue, job, result, duration) => {
            console.log(
                `job success ${queue} ${JSON.stringify(job)} >> ${result} (${duration}ms)`
            );
        });
        this.worker.on("failure", (queue, job, failure, duration) => {
            console.log(
                `job failure ${queue} ${JSON.stringify(
                    job
                )} >> ${failure} (${duration}ms)`
            );
        });
        this.worker.on("error", (error, queue, job) => {
            console.log(`error ${queue} ${JSON.stringify(job)}  >> ${error}`);
        });
        this.scheduler = new Scheduler({connection}, this.jobs);
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
        this.initialize();
        const jobName = this.tryResolve(jobType, params);
        await this.queue.connect();
        return jobName;
    }

    protected resolveJobInstance(jobType: Type<IJob>, params: JobParams): IJob {
        const container = this.container.createChildContainer();
        Object.keys(params).map((name) => {
            container.register(name, {useValue: params[name]});
        });
        container.register(jobType, jobType);

        return container.resolve(jobType) as IJob;
    }

    protected toPerformFunction(jobType: Type<IJob>): Function {
        return (jobParams: JobParams) => {
            const job = this.resolveJobInstance(jobType, jobParams);
            return job.process();
        }
    }
}
