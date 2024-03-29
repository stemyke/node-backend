import {IAsset, IJob, IMessageBridge, IProgress} from "../common-types";
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

    abstract generate(progress: IProgress, messaging?: IMessageBridge): Promise<IAsset>;

    async process(messaging: IMessageBridge): Promise<any> {
        const lazyAsset = await this.lazyAssets.read(this.lazyId);
        let progress = await this.progresses.get(lazyAsset.progressId);
        if (!progress || progress.canceled) return null;
        progress.setMessageBridge(messaging);
        try {
            const asset = await this.generate(progress, messaging);
            progress = await progress.load();
            if (!progress || progress.canceled) return null;
            await lazyAsset.writeAsset(asset);
        } catch (e) {
            await progress.setError(e.message || e);
            throw e;
        }
        if (progress.remaining > 0) {
            await progress.advance(progress.remaining);
        }
    }
}
