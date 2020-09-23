import {Inject, Injectable, Injector, Optional, ReflectiveInjector, Type} from "injection-js";
import {Queue, Scheduler, Worker} from "node-resque";
import {IJob, JOB, JobParams} from "../common-types";
import {Configuration} from "./configuration";

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
        console.log(this.jobs);

        this.queue = new Queue({connection}, this.jobs);
        this.worker = new Worker({connection, queues}, this.jobs);
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
        console.log("Job?", jobName);
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
