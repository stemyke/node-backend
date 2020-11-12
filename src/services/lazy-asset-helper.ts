import {Injectable} from "injection-js";
import {IAsset} from "../common-types";
import {LazyAsset, LazyAssetDoc} from "../models/lazy-asset";
import {Assets} from "./assets";
import {Progresses} from "./progresses";
import {JobManager} from "./job-manager";

@Injectable()
export class LazyAssetHelper {

    constructor(private assets: Assets, private progresses: Progresses, private jobMan: JobManager) {

    }

    async loadAsset(lazyAsset: LazyAssetDoc): Promise<IAsset> {
        if (lazyAsset.assetId) {
            return this.assets.read(lazyAsset.id);
        }
        if (lazyAsset.progressId) {
            await this.progresses.waitToFinish(lazyAsset.progressId as string);
            lazyAsset = await LazyAsset.findById(lazyAsset.id);
            return this.loadAsset(lazyAsset);
        }
        const progress = await this.progresses.create();
        lazyAsset.progressId = progress.id;
        await lazyAsset.save();
        await this.jobMan.enqueueWithName(lazyAsset.jobName, {...lazyAsset.jobParams, lazyId: lazyAsset.id});
        return this.loadAsset(lazyAsset);
    }

    async writeAsset(lazyAsset: LazyAssetDoc, asset: IAsset): Promise<IAsset> {
        lazyAsset.assetId = asset.id;
        await lazyAsset.save();
        return asset;
    }
}
