import {Readable} from "stream";
import {Collection} from "mongodb";
import {ObjectId} from "bson";

import {IAsset, IAssetDriver, IAssetImageParams, IAssetMeta} from "../../common-types";
import {isString, streamToBuffer, toImage} from "../../utils";
import {BaseEntity} from "./base-entity";

export class Asset extends BaseEntity<IAsset> implements IAsset {

    get filename(): string {
        return this.data.filename;
    }

    get streamId(): ObjectId {
        return this.data.streamId || this.oid;
    }

    get driverId(): string {
        return this.data.driverId;
    }

    get contentType(): string {
        return this.data.contentType;
    }

    get metadata(): IAssetMeta {
        return this.data.metadata;
    }

    get stream(): Readable {
        return this.driver.openDownloadStream(this);
    }

    constructor(id: ObjectId,
                data: Partial<IAsset>,
                collection: Collection,
                protected driver: IAssetDriver) {
        super(id, data, collection);
    }

    async unlink(): Promise<string> {
        try {
            await this.driver.delete(this);
        } catch (error) {
            console.log("Failed to unlink", error?.message);
        }
        await this.collection.deleteOne({_id: this.oid});
        return this.id;
    }

    async setMeta(metadata: Partial<IAssetMeta>): Promise<any> {
        metadata = Object.assign(this.metadata, metadata || {});
        await this.collection.updateOne({_id: this.oid}, {$set: {metadata}});
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
        await this.collection.updateOne({_id: this.oid}, {$set: {metadata}});
        return this.stream;
    }

    async getImage(params: IAssetImageParams = null): Promise<Readable> {
        return toImage(this.stream, params, this.metadata);
    }

    async downloadImage(params?: IAssetImageParams, metadata?: IAssetMeta): Promise<Readable> {
        return toImage(await this.download(metadata), params, this.metadata);
    }
}
