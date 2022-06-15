import {Readable} from "stream";
import {Collection, GridFSBucket} from "mongodb";
import {ObjectId} from "bson";

import {IAsset, IAssetImageParams, IAssetMeta} from "../../common-types";
import {deleteFromBucket, streamToBuffer, toImage} from "../../utils";
import {BaseEntity} from "./base-entity";

export class Asset extends BaseEntity<IAsset> implements IAsset {

    get filename(): string {
        return this.data.filename;
    }

    get contentType(): string {
        return this.data.contentType;
    }

    get metadata(): IAssetMeta {
        return this.data.metadata;
    }

    get stream(): Readable {
        return this.bucket.openDownloadStream(this.mId);
    }

    constructor(id: ObjectId,
                data: Partial<IAsset>,
                collection: Collection,
                protected bucket: GridFSBucket) {
        super(id, data, collection);
    }

    async unlink(): Promise<string> {
        return deleteFromBucket(this.bucket, this.mId);
    }

    getBuffer(): Promise<Buffer> {
        return streamToBuffer(this.stream);
    }

    async download(metadata?: IAssetMeta): Promise<Readable> {
        metadata = Object.assign(this.metadata, metadata || {});
        metadata.downloadCount = isNaN(metadata.downloadCount) || !metadata.firstDownload
            ? 1
            : metadata.downloadCount + 1;
        metadata.firstDownload = metadata.firstDownload || new Date();
        metadata.lastDownload = new Date();
        await this.collection.updateOne({_id: this.mId}, {$set: {metadata}});
        return this.stream;
    }

    async getImage(params: IAssetImageParams = null): Promise<Readable> {
        return toImage(this.stream, params, this.metadata);
    }

    async downloadImage(params?: IAssetImageParams, metadata?: IAssetMeta): Promise<Readable> {
        return toImage(await this.download(metadata), params, this.metadata);
    }
}
