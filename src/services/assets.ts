import {injectable, Lifecycle, scoped} from "tsyringe";
import {fromBuffer} from "file-type";
import {Readable} from "stream";
import {ObjectId} from "bson";
import {Collection, GridFSBucket} from "mongodb";
import {FilterQuery} from "mongoose";

import {bufferToStream} from "../utils";
import {IAsset, IAssetMeta} from "../common-types";
import {MongoConnector} from "./mongo-connector";
import {AssetProcessor} from "./asset-processor";
import {Asset} from "./entities/asset";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class Assets {

    readonly bucket: GridFSBucket;
    readonly collection: Collection;

    constructor(readonly connector: MongoConnector, readonly assetProcessor: AssetProcessor) {
        this.bucket = connector.bucket;
        this.collection = connector.database.collection("assets.files");
    }

    write(stream: Readable, contentType: string, metadata: IAssetMeta = null): Promise<IAsset> {
        if (!contentType) {
            return Promise.reject(`Content type should be provided!`);
        }
        metadata = Object.assign({
            downloadCount: 0,
            firstDownload: null,
            lastDownload: null
        }, metadata || {});
        metadata.filename = metadata.filename || new ObjectId().toHexString();
        return new Promise<IAsset>(((resolve, reject) => {
            const uploadStream = this.bucket.openUploadStream(metadata.filename);
            stream.pipe(uploadStream)
                .on("error", error => {
                    reject(error.message || error);
                })
                .on("finish", () => {
                    const asset = new Asset(uploadStream.id as ObjectId, metadata.filename, contentType, metadata, this.bucket, this.collection);
                    this.collection.updateOne({_id: uploadStream.id}, {$set: asset.toJSON()}).then(() => {
                        resolve(asset);
                    }, error => {
                        reject(error.message || error);
                    });
                });
        }));
    }

    async writeBuffer(buffer: Buffer, metadata: IAssetMeta = null, contentType: string = null): Promise<IAsset> {
        try {
            contentType = (contentType || (await fromBuffer(buffer)).mime).trim();
        } catch (e) {
            console.log(`Can't determine content type`, e);
        }
        metadata = metadata || {};
        const processed = await this.assetProcessor.process(buffer, metadata, contentType);
        if (processed !== buffer) {
            try {
                contentType = (await fromBuffer(processed)).mime.trim();
            } catch (e) {
                console.log(`Can't determine content type`, e);
            }
        }
        return this.write(bufferToStream(processed), contentType, metadata);
    }

    async read(id: string): Promise<IAsset> {
        return this.find({_id: new ObjectId(id)});
    }

    async find(where: FilterQuery<IAsset>): Promise<IAsset> {
        const data = await this.collection.findOne(where);
        return !data ? null : new Asset(data._id, data.filename, data.contentType, data.metadata, this.bucket, this.collection);
    }

    async unlink(id: string): Promise<any> {
        const asset = await this.read(id);
        if (!asset) return null;
        return asset.unlink();
    }
}
