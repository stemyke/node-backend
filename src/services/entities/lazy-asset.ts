import {Collection} from "mongodb";
import {ObjectId} from "bson";

import {IAsset, ILazyAsset} from "../../common-types";
import {deleteFromBucket} from "../../utils";
import {Assets} from "../assets";
import {JobManager} from "../job-manager";
import {Progresses} from "../progresses";
import {BaseEntity} from "./base-entity";

export class LazyAsset extends BaseEntity<ILazyAsset> implements ILazyAsset {

    get jobName(): string {
        return this.data.jobName;
    }

    get jobParams(): any {
        return this.data.jobParams;
    }

    get jobQue(): string {
        return this.data.jobQue;
    }

    get progressId(): string {
        return this.data.progressId;
    }

    get assetId(): string {
        return this.data.assetId;
    }

    constructor(id: ObjectId,
                data: Partial<ILazyAsset>,
                collection: Collection,
                protected assets: Assets,
                protected progresses: Progresses,
                protected jobMan: JobManager) {
        super(id, data, collection);
    }

    async unlink(): Promise<string> {
        await this.load();
        if (!this.progressId) {
            await this.collection.deleteOne({_id: this.mId});
        }
        return deleteFromBucket(this.assets.bucket, new ObjectId(this.assetId));
    }

    startWorking(): void {
        this.load().then(() => {
            if (this.deleted) return;
            const progressPromise = !this.progressId ? Promise.resolve(null) : this.progresses.get(this.progressId).then(p => p.cancel());
            progressPromise.then(() => {
                this.startWorkingOnAsset().then(() => {
                    console.log(`Started working on lazy asset: ${this.id}`);
                }).catch(reason => {
                    console.log(`Can't start working on lazy asset: ${this.id}\nReason: ${reason}`);
                });
            });
        });
    }

    async loadAsset(): Promise<IAsset> {
        await this.load();
        if (this.deleted) return null;
        if (this.assetId) {
            return this.assets.read(this.assetId);
        }
        if (this.progressId) {
            await this.progresses.waitToFinish(this.progressId);
            return this.loadAsset();
        }
        await this.startWorkingOnAsset();
        return this.loadAsset();
    }

    async writeAsset(asset: IAsset): Promise<IAsset> {
        this.data.assetId = asset.id;
        await this.save();
        return asset;
    }

    protected async startWorkingOnAsset(): Promise<any> {
        const {id} = await this.progresses.create();
        this.data.progressId = id;
        await this.save();
        await this.jobMan.enqueueWithName(this.data.jobName, {...this.data.jobParams, lazyId: this.id});
    }
}
