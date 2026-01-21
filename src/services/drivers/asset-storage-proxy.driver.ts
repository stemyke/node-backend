import {Readable} from "stream";
import {injectable} from "tsyringe";
import {ObjectId} from "bson";
import got from "got";
import {IAsset, IAssetDriver, IAssetUploadOpts, IAssetUploadStream} from "../../common-types";
import {Configuration} from "../configuration";
import {createFallbackReadable} from "./fallback-streams";

@injectable()
export class AssetStorageProxyDriver implements IAssetDriver {

    readonly baseUrl: string;
    readonly url: string;

    constructor(protected config: Configuration) {
        this.baseUrl = this.config.resolve("storageProxyUri");
        this.url = this.baseUrl + this.config.resolve("storageProxyBucket");
    }

    openUploadStream(_: string, opts: IAssetUploadOpts): IAssetUploadStream {
        const id = new ObjectId();
        const stream = got.stream.put(this.getUrl(id, opts.extension), {headers: {
                'Content-Type': opts?.contentType || 'application/octet-stream'
            }}) as IAssetUploadStream;
        stream.done = false;
        stream.on('finish', () => {
            stream.id = id;
            stream.done = true;
        });
        return stream;
    }

    openDownloadStream(asset: IAsset): Readable {
        return createFallbackReadable(
            got.stream.get(this.getUrl(asset.streamId, asset.metadata.extension)),
            () => got.stream.get(this.getUrl(asset.streamId))
        );
    }

    async delete(asset: IAsset): Promise<void> {
        try {
            await got.delete(this.getUrl(asset.streamId, asset.metadata.extension));
        } catch (e) {
            await got.delete(this.getUrl(asset.streamId));
        }
    }

    protected getUrl(id: ObjectId, ext?: string): string {
        return !ext ? `${this.url}/${id.toHexString()}` : `${this.url}/${id.toHexString()}.${ext}`;
    }
}
