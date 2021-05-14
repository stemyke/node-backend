import {Injectable, Type} from "injection-js";
import {ObjectId} from "bson";
import {FilterQuery} from "mongoose";
import {IJob, ILazyAsset, JobParams} from "../common-types";
import {deleteFromBucket} from "../utils";
import {LazyAsset, LazyAssetDoc} from "../models/lazy-asset";
import {JobManager} from "./job-manager";
import {MongoConnector} from "./mongo-connector";

@Injectable()
export class LazyAssets {

    constructor(readonly jobMan: JobManager, readonly connector: MongoConnector) {

    }

    async create(jobType: Type<IJob>, jobParams: JobParams = {}, jobQue: string = "main"): Promise<ILazyAsset> {
        const lazyAsset = new LazyAsset({
            jobName: this.jobMan.tryResolve(jobType, {...jobParams, lazyId: ""}),
            jobParams,
            jobQue
        });
        await lazyAsset.save();
        return lazyAsset as ILazyAsset;
    }

    async read(id: string): Promise<ILazyAsset> {
        return (await LazyAsset.findById(id)) as ILazyAsset;
    }

    async find(where: FilterQuery<LazyAssetDoc>): Promise<ILazyAsset> {
        return (await LazyAsset.findOne(where)) as ILazyAsset;
    }

    async unlink(id: string): Promise<any> {
        const asset = await LazyAsset.findById(id);
        if (!asset || !asset.assetId) return;
        await asset.remove();
        await deleteFromBucket(this.connector.bucket, new ObjectId(asset.assetId as string));
    }
}
