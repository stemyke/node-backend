import {injectable, Lifecycle, scoped} from "tsyringe";
import {ObjectId} from "bson";
import {Collection} from "mongodb";
import {FilterQuery} from "mongoose";
import {IJob, ILazyAsset, JobParams, Type} from "../common-types";
import {MongoConnector} from "./mongo-connector";
import {Assets} from "./assets";
import {LazyAsset} from "./entities/lazy-asset";
import {JobManager} from "./job-manager";
import {Progresses} from "./progresses";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class LazyAssets {

    protected collection: Collection;

    constructor(readonly connector: MongoConnector, readonly assets: Assets,
                readonly progresses: Progresses, readonly jobMan: JobManager) {
        this.collection = connector.database.collection("lazyassets");
    }

    async create(jobType: Type<IJob>, jobParams: JobParams = {}, jobQue: string = "main"): Promise<ILazyAsset> {
        const jobName = this.jobMan.tryResolve(jobType, {...jobParams, lazyId: ""});
        const data = {
            jobName,
            jobParams,
            jobQue
        };
        const existingAsset = await this.find(data);
        if (existingAsset) return existingAsset;
        const res = await this.collection.insertOne(data);
        return new LazyAsset(
            res.insertedId, data, this.collection,
            this.assets, this.progresses, this.jobMan
        );
    }

    async read(id: string): Promise<ILazyAsset> {
        return !id ? null : this.find({_id: new ObjectId(id)});
    }

    async find(where: FilterQuery<ILazyAsset>): Promise<ILazyAsset> {
        const data = await this.collection.findOne(where);
        return !data
            ? null
            : new LazyAsset(
                data._id, data, this.collection,
                this.assets, this.progresses, this.jobMan
            );
    }

    async unlink(id: string): Promise<any> {
        const asset = await this.read(id);
        if (!asset) return null;
        return asset.unlink();
    }
}
