import {injectable, singleton} from "tsyringe";
import {IAsset} from "../common-types";
import {LazyAsset, LazyAssetDoc} from "../models/lazy-asset";
import {Assets} from "./assets";
import {Progresses} from "./progresses";
import {JobManager} from "./job-manager";

@injectable()
@singleton()
export class LazyAssetHelper {

    constructor(private assets: Assets, private progresses: Progresses, private jobMan: JobManager) {

    }

    async loadAsset(lazyAsset: LazyAssetDoc): Promise<IAsset> {
        if (lazyAsset.assetId) {
            return this.assets.read(lazyAsset.assetId as string);
        }
        if (lazyAsset.progressId) {
            await this.progresses.waitToFinish(lazyAsset.progressId as string);
            lazyAsset = await LazyAsset.findById(lazyAsset.id);
            return this.loadAsset(lazyAsset);
        }
        await this.startWorkingOnAsset(lazyAsset);
        return this.loadAsset(lazyAsset);
    }

    startWorking(lazyAsset: LazyAssetDoc): void {
        if (lazyAsset.progressId) return;
        this.startWorkingOnAsset(lazyAsset).then(() => {
            console.log(`Started working on lazy asset: ${lazyAsset.id}`);
        }).catch(reason => {
            console.log(`Can't start working on lazy asset: ${lazyAsset.id}\nReason: ${reason}`);
        });
    }

    async writeAsset(lazyAsset: LazyAssetDoc, asset: IAsset): Promise<IAsset> {
        lazyAsset.assetId = asset.id;
        await lazyAsset.save();
        return asset;
    }

    protected async startWorkingOnAsset(asset: LazyAssetDoc): Promise<any> {
        const progress = await this.progresses.create();
        asset.progressId = progress.id;
        await asset.save();
        await this.jobMan.enqueueWithName(asset.jobName, {...asset.jobParams, lazyId: asset.id});
    }
}
