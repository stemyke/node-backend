import {Collection} from "mongodb";
import {ObjectId} from "bson";

import {IAsset, ILazyAsset} from "../../common-types";
import {deleteFromBucket, gunzipPromised, isObject} from "../../utils";
import {Assets} from "../assets";
import {Progresses} from "../progresses";
import {BaseEntity} from "./base-entity";
import {Logger} from "../logger";

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

    get createdAt(): Date {
        return this.data.createdAt;
    }

    get updatedAt(): Date {
        return this.data.updatedAt;
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
                protected logger: Logger,
                protected assets: Assets,
                protected progresses: Progresses) {
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
            this.progresses.get(this.progressId).then(p => {
                p?.cancel();
            });
            this.startWorkingOnAsset(false).then(() => {
                this.logger.log("lazy-assets", `Started working on lazy asset: ${this.id}`);
            }).catch(reason => {
                this.logger.log("lazy-assets", `Can't start working on lazy asset: ${this.id}\nReason: ${reason}`);
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
        await this.startWorkingOnAsset(true);
        return this.loadAsset();
    }

    async writeAsset(asset: IAsset): Promise<IAsset> {
        this.data.updatedAt = new Date();
        this.data.assetId = asset.id;
        await asset.setMeta({lazyId: this.id});
        await this.save();
        return asset;
    }

    protected async startWorkingOnAsset(fromLoad: boolean): Promise<any> {
        const oldAsset = this.data.assetId;
        this.data.updatedAt = new Date();
        this.data.progressId = (await this.progresses.create()).id;
        this.data.assetId = null;
        await this.save();
        await deleteFromBucket(this.assets.bucket, oldAsset);
        const jobParams = JSON.parse(await gunzipPromised(this.data.jobParams));
        await this.progresses.jobMan.enqueueWithName(this.data.jobName, {...jobParams, lazyId: this.id, fromLoad});
    }
}
