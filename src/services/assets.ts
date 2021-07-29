import {injectable, Lifecycle, scoped} from "tsyringe";
import {fromBuffer, fromStream} from "file-type";
import {Readable} from "stream";
import {ObjectId} from "bson";
import {Collection, GridFSBucket} from "mongodb";
import {FilterQuery} from "mongoose";

import {bufferToStream, copyStream} from "../utils";
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

    async write(stream: Readable, contentType: string = null, metadata: IAssetMeta = null): Promise<IAsset> {
        let extension: string = null;
        const fileTypeStream = copyStream(stream);
        const uploadStream = copyStream(stream);
        try {
            const fileType = await fromStream(fileTypeStream);
            contentType = fileType.mime;
            extension = fileType.ext;
        } catch (e) {
            if (!contentType) {
                throw `Can't determine content type`;
            }
            console.log(`Can't determine content type`, e);
        }
        contentType = contentType.trim();
        extension = (extension || "").trim();
        metadata = Object.assign({
            extension,
            downloadCount: 0,
            firstDownload: null,
            lastDownload: null
        }, metadata || {});
        metadata.filename = metadata.filename || new ObjectId().toHexString();
        return new Promise<IAsset>(((resolve, reject) => {
            const uploaderStream = this.bucket.openUploadStream(metadata.filename);
            uploadStream.pipe(uploaderStream)
                .on("error", error => {
                    reject(error.message || error);
                })
                .on("finish", () => {
                    const asset = new Asset(uploaderStream.id as ObjectId, metadata.filename, contentType, metadata, this.bucket, this.collection);
                    this.collection.updateOne({_id: uploaderStream.id}, {$set: asset.toJSON()}).then(() => {
                        resolve(asset);
                    }, error => {
                        reject(error.message || error);
                    });
                });
        }));
    }

    async writeBuffer(buffer: Buffer, metadata: IAssetMeta = null, contentType: string = null): Promise<IAsset> {
        try {
            contentType = (await fromBuffer(buffer)).mime;
        } catch (e) {
            if (!contentType) {
                throw `Can't determine content type`;
            }
            console.log(`Can't determine content type`, e);
        }
        metadata = metadata || {};
        buffer = await this.assetProcessor.process(buffer, metadata, contentType);
        return this.write(bufferToStream(buffer), contentType, metadata);
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
