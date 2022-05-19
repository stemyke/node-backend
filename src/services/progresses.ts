import {injectable, singleton} from "tsyringe";
import {ObjectId} from "bson";
import {Collection} from "mongodb";
import {FilterQuery} from "mongoose";
import {IProgress} from "../common-types";
import {promiseTimeout} from "../utils";
import {MongoConnector} from "./mongo-connector";
import {JobManager} from "./job-manager";
import {Progress} from "./entities/progress";

@injectable()
@singleton()
export class Progresses {

    protected collection: Collection;
    protected progresses: {[id: string]: IProgress};

    constructor(readonly connector: MongoConnector, readonly jobMan: JobManager) {
        this.collection = connector.database.collection("progresses");
        this.progresses = {};
        this.jobMan.on("progress-changed", progress => {
            const id = progress.id as string;
            this.progresses[id] = new Progress(new ObjectId(id), progress as any, this.collection);
        });
    }

    async waitToFinish(id: string): Promise<IProgress> {
        return Promise.race([
            this.waitForProgress(id, async () => {
                let progress = this.progresses[id];
                if (!progress || progress.percent < 100) {
                    progress = await this.get(id);
                }
                if (!progress) {
                    throw new Error(`Progress does not exists with id: ${id}`);
                }
                return progress;
            }, 500),
            this.waitForProgress(id, async () => {
                return this.progresses[id] || null;
            }, 25)
        ]);
    }

    async get(id: string): Promise<IProgress> {
        return !id ? null : this.find({_id: new ObjectId(id)});
    }

    async find(where: FilterQuery<IProgress>): Promise<IProgress> {
        const data = await this.collection.findOne(where);
        return !data ? null : new Progress(data._id, data, this.collection);
    }

    async create(max: number = 100): Promise<IProgress> {
        if (isNaN(max) || max <= 0) {
            throw new Error(`Max progress value must be bigger than zero`);
        }
        const data = {
            current: 0,
            max: max,
            message: "",
            error: "",
            canceled: false
        };
        const res = await this.collection.insertOne(data);
        return new Progress(res.insertedId, data, this.collection);
    }

    async remove(id: string): Promise<any> {
        await this.collection.deleteOne({_id: new ObjectId(id)});
        return id;
    }

    protected async waitForProgress(id: string, cb: () => Promise<IProgress>, delay: number): Promise<IProgress> {
        let isFinished = false;
        let progress: IProgress = null;
        let waitTime: number = 0;
        while (!isFinished) {
            progress = await cb();
            waitTime += delay;
            if (progress) {
                if (progress.error) {
                    throw new Error(progress.error);
                }
                isFinished = progress.percent >= 100;
            }
            if (!isFinished) {
                if (waitTime >= this.jobMan.maxTimeout) {
                    throw new Error(`Progress with id: ${id} probably never will be finished!`);
                }
                await promiseTimeout(delay);
            }
        }
        return progress;
    }
}
