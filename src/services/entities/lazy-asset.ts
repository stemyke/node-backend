import {Collection} from "mongodb";
import {ObjectId} from "bson";

import {IAsset, ILazyAsset} from "../../common-types";
import {deleteFromBucket} from "../../utils";
import {Assets} from "../assets";
import {JobManager} from "../job-manager";
import {Progresses} from "../progresses";

export class LazyAsset implements ILazyAsset {

    get id(): string {
        return this.lazyId.toHexString();
    }

    get progressId(): string {
        return this.mProgressId;
    }

    get assetId(): string {
        return this.mAssetId;
    }

    constructor(readonly lazyId: ObjectId,
                readonly jobName: string,
                readonly jobParams: any,
                readonly jobQue: string,
                protected mProgressId: string,
                protected mAssetId: string,
                protected assets: Assets,
                protected progresses: Progresses,
                protected jobMan: JobManager,
                protected collection: Collection) {
    }

    async unlink(): Promise<string> {
        await this.collection.deleteOne({_id: this.lazyId});
        return deleteFromBucket(this.assets.bucket, new ObjectId(this.mAssetId as string));
    }

    startWorking(): void {
        if (this.mProgressId) return;
        this.startWorkingOnAsset().then(() => {
            console.log(`Started working on lazy asset: ${this.id}`);
        }).catch(reason => {
            console.log(`Can't start working on lazy asset: ${this.id}\nReason: ${reason}`);
        });
    }

    async loadAsset(): Promise<IAsset> {
        if (this.mAssetId) {
            return this.assets.read(this.mAssetId as string);
        }
        if (this.mProgressId) {
            await this.progresses.waitToFinish(this.mProgressId as string);
            const data = await this.collection.findOne({_id: this.lazyId});
            this.mAssetId = data.assetId;
            return this.loadAsset();
        }
        await this.startWorkingOnAsset();
        return this.loadAsset();
    }

    async writeAsset(asset: IAsset): Promise<IAsset> {
        this.mAssetId = asset.id;
        await this.save();
        return asset;
    }

    save(): Promise<any> {
        return this.collection.updateOne({_id: this.lazyId}, {$set: this.toJSON()});
    }

    toJSON(): any {
        return {
            id: this.id,
            jobName: this.jobName,
            jobParams: this.jobParams,
            jobQue: this.jobQue,
            progressId: this.progressId,
            assetId: this.assetId,
        };
    }

    protected async startWorkingOnAsset(): Promise<any> {
        const progress = await this.progresses.create();
        this.mProgressId = progress.id;
        await this.save();
        await this.jobMan.enqueueWithName(this.jobName, {...this.jobParams, lazyId: this.id});
    }
}
