import {Readable} from "stream";
import {Collection} from "mongodb";
import {ObjectId} from "bson";

import {IAsset, IAssetDriver, IAssetDrivers, IAssetImageParams, IAssetMeta} from "../../common-types";
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

    get driver(): IAssetDriver {
        return this.drivers.getDriver(this.driverId || this.drivers.missingDriver);
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
                protected drivers: IAssetDrivers) {
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

    async move(driverId: string): Promise<IAsset> {
        const oldDriver = this.driver;
        const targetDriver = this.drivers.getDriver(driverId);
        if (targetDriver === oldDriver) return this;
        const oldAsset = new Asset(this.oid, this.data, this.collection, this.drivers);
        const streamId = await this.uploadTo(targetDriver);
        this.data = {
            ...this.data,
            streamId,
            driverId,
        };
        await this.save();
        await oldDriver.delete(oldAsset);
    }

    protected uploadTo(driver: IAssetDriver): Promise<ObjectId> {
        return new Promise((resolve, reject) => {
            const uploaderStream = driver.openUploadStream(this.filename, {
                chunkSizeBytes: 1048576,
                contentType: this.contentType,
                extension: this.metadata.extension,
                metadata: this.metadata,
            });
            this.stream.pipe(uploaderStream)
                .on("error", error => {
                    reject(error.message || error);
                })
                .on("finish", async () => {
                    resolve(uploaderStream.id);
                });
        });
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
