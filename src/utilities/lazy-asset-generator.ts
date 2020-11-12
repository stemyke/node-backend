import {IJob, ILazyAsset, IProgress} from "../common-types";
import {Assets} from "../services/assets";
import {LazyAssets} from "../services/lazy-assets";
import {AssetResolver} from "../services/asset-resolver";
import {Progresses} from "../services/progresses";

export abstract class LazyAssetGenerator implements IJob {

    get assets(): Assets {
        return this.assetResolver.assets;
    }

    get lazyAssets(): LazyAssets {
        return this.assetResolver.lazyAssets;
    }

    protected constructor(protected assetResolver: AssetResolver, protected progresses: Progresses, protected lazyId: string) {
    }

    abstract generate(lazyAsset: ILazyAsset, progress: IProgress): Promise<any>;

    async process(): Promise<any> {
        const lazyAsset = await this.lazyAssets.read(this.lazyId);
        const progress = await this.progresses.get(lazyAsset.progressId);
        await this.generate(lazyAsset, progress);
    }
}
