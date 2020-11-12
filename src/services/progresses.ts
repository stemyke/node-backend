import {Injectable} from "injection-js";
import {ObjectId} from "bson";
import {FilterQuery} from "mongoose";
import {Progress, ProgressDoc} from "../models/progress";
import {IProgress} from "../common-types";
import {promiseTimeout} from "../utils";

@Injectable()
export class Progresses {

    constructor() {

    }

    async waitToFinish(id: string): Promise<IProgress> {
        let isFinished = false;
        let progress: IProgress = null;
        while (!isFinished) {
            progress = await this.get(id);
            if (!progress) {
                throw `Progress does not exists with id: ${id}`;
            }
            isFinished = progress.percent == 100;
            if (!isFinished) {
                await promiseTimeout(300);
            }
        }
        return progress;
    }

    async get(id: string): Promise<IProgress> {
        return this.find({_id: new ObjectId(id)});
    }

    async find(where: FilterQuery<ProgressDoc>): Promise<IProgress> {
        const progress = await Progress.findOne(where);
        if (!progress) return null;
        return progress;
    }

    async create(max: number = 100): Promise<IProgress> {
        const progress = new Progress();
        progress.current = 0;
        await progress.setMax(max);
        return progress;
    }

    remove(id: string): Promise<any> {
        return new Promise<any>(resolve => {
            Progress.findByIdAndDelete(id).then(resolve, resolve);
        });
    }
}
