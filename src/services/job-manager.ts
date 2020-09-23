import {Inject, Injectable, Injector, Optional, ReflectiveInjector, Type} from "injection-js";
import {Queue, Scheduler, Worker} from "node-resque";
import {schedule, validate} from "node-cron";
import {IJob, IJobTask, JOB, JobParams, JobScheduleRange, JobScheduleTime} from "../common-types";
import {Configuration} from "./configuration";
import {isArray, isObject} from "../utils";

@Injectable()
export class JobManager {

    protected jobs: any;
    protected queue: Queue;
    protected worker: Worker;
    protected scheduler: Scheduler;

    constructor(readonly config: Configuration, readonly injector: Injector, @Optional() @Inject(JOB) jobTypes: Type<IJob>[]) {
        jobTypes = jobTypes || [];
        const options = {password: config.resolve("redisPassword")};
        const connection = {
            pkg: "ioredis",
            host: config.resolve("redisHost"),
            password: options.password,
            port: config.resolve("redisPort"),
            namespace: config.resolve("redisNamespace"),
            options
        };
        const queues = config.resolve("workQueues");
        this.jobs = jobTypes.reduce((res, jobType) => {
            res[this.getConstructorName(jobType)] = {
                perform: this.toPerformFunction(jobType)
            };
            return res;
        }, {});
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
        const jobName = this.getConstructorName(jobType);
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
        await this.worker.connect();
        await this.worker.start();
        await this.scheduler.connect();
        await this.scheduler.start();
    }

    protected async tryResolveAndConnect(jobType: Type<IJob>, params: JobParams): Promise<string> {
        const jobName = this.getConstructorName(jobType);
        if (!this.jobs[jobName]) {
            throw `Can't find job with name: ${jobName} so it can't be enqueued!`;
        }
        try {
            this.resolveJobInstance(jobType, params);
        } catch (e) {
            throw `Can't resolve params for job: ${jobName}, with params: ${JSON.stringify(params)}. Reason: ${e}`;
        }
        await this.queue.connect();
        return jobName;
    }

    protected resolveJobInstance(jobType: Type<IJob>, params: JobParams): IJob {
        const paramProviders = Object.keys(params).map((name) => {
            return {
                provide: name,
                useValue: params[name]
            }
        });
        const injector = ReflectiveInjector.resolveAndCreate([...paramProviders, jobType], this.injector);
        return injector.get(jobType) as IJob;
    }

    protected getConstructorName(jobType: Type<IJob>): string {
        return jobType.prototype.constructor.name;
    }

    protected toPerformFunction(jobType: Type<IJob>): Function {
        return (jobParams: JobParams) => {
            const job = this.resolveJobInstance(jobType, jobParams);
            return job.process();
        }
    }
}
