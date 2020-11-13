import {Injectable, Type} from "injection-js";
import {ObjectId} from "bson";
import {connection, FilterQuery} from "mongoose";
import {createModel} from "mongoose-gridfs";
import {IAssetConnection, IJob, ILazyAsset, JobParams} from "../common-types";
import {LazyAsset, LazyAssetDoc} from "../models/lazy-asset";
import {JobManager} from "./job-manager";

@Injectable()
export class LazyAssets {

    private asset: IAssetConnection;

    constructor(readonly jobMan: JobManager) {
        this.asset = createModel({
            modelName: "Asset",
            connection
        });
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
        return this.find({_id: new ObjectId(id)});
    }

    async find(where: FilterQuery<LazyAssetDoc>): Promise<ILazyAsset> {
        return (await LazyAsset.findOne(where)) as ILazyAsset;
    }

    async unlink(id: string): Promise<any> {
        const asset = await LazyAsset.findOne({_id: new ObjectId(id)});
        if (!asset || !asset.assetId) return;
        await asset.remove();
        await this.unlinkAsset(asset.assetId as string);
    }

    private unlinkAsset(id: string): Promise<any> {
        return new Promise<string>(((resolve, reject) => {
            this.asset.unlink({_id: new ObjectId(id)}, (error) => {
                if (error) {
                    error = error.message || error;
                    if (error !== "not found") {
                        reject(error.message || error);
                        return;
                    }
                }
                resolve();
            });
        }));
    }
}
