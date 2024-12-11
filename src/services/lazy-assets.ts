import {injectable, Lifecycle, scoped} from "tsyringe";
import {ObjectId} from "bson";
import {Collection} from "mongodb";
import {FilterQuery} from "mongoose";
import {IJob, ILazyAsset, JobParams, Type} from "../common-types";
import {MongoConnector} from "./mongo-connector";
import {Assets} from "./assets";
import {LazyAsset} from "./entities/lazy-asset";
import {JobManager} from "./job-manager";
import {Logger} from "./logger";
import {Progresses} from "./progresses";
import {gzipPromised} from '../utils';

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class LazyAssets {

    protected collection: Collection<Partial<ILazyAsset>>;

    constructor(readonly connector: MongoConnector,
                readonly assets: Assets,
                readonly progresses: Progresses,
                readonly logger: Logger,
                readonly jobMan: JobManager) {
        this.collection = connector.database.collection("lazyassets");
    }

    async create(jobType: Type<IJob>, jobParamsObj: JobParams = {}, jobQue: string = "main"): Promise<ILazyAsset> {
        const jobName = this.jobMan.tryResolve(jobType, {...jobParamsObj, lazyId: ""});
        const jobParams = await gzipPromised(JSON.stringify(jobParamsObj));
        const data = {
            jobName,
            jobParams,
            jobQue,
        } as ILazyAsset;
        const existingAsset = await this.find(data);
        if (existingAsset) return existingAsset;
        data.createdAt = new Date();
        data.updatedAt = data.createdAt;
        const res = await this.collection.insertOne(data);
        return new LazyAsset(res.insertedId, data, this.collection, this.logger, this.assets, this.progresses);
    }

    async read(id: string | ObjectId): Promise<ILazyAsset> {
        return !id ? null : this.find({_id: new ObjectId(id)});
    }

    async find(where: FilterQuery<ILazyAsset>): Promise<ILazyAsset> {
        const data = await this.collection.findOne(where);
        return !data
            ? null
            : new LazyAsset(data._id, data, this.collection, this.logger, this.assets, this.progresses);
    }

    async unlink(id: string): Promise<any> {
        const asset = await this.read(id);
        if (!asset) return null;
        return asset.unlink();
    }
}
