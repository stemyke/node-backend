import {Injectable} from "injection-js";
import {IAsset} from "../common-types";
import {Assets} from "./assets";
import {LazyAssets} from "./lazy-assets";

@Injectable()
export class AssetResolver {

    constructor(readonly assets: Assets, readonly lazyAssets: LazyAssets) {

    }

    async resolve(id: string, lazy: boolean = false): Promise<IAsset> {
        let asset: IAsset = null;
        if (lazy) {
            const lazyAsset = await this.lazyAssets.read(id);
            if (!lazyAsset) return null;
            return lazyAsset.loadAsset();
        }
        asset = await this.assets.read(id);
        if (!asset) {
            const lazyAsset = await this.lazyAssets.read(id);
            if (!lazyAsset) return null;
            return lazyAsset.loadAsset();
        }
        return asset;
    }
}
