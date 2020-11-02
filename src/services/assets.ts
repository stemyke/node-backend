import {Injectable} from "injection-js";
import {fromBuffer} from "file-type";
import {Readable} from "stream";
import {ObjectId} from "bson";
import {connection, FilterQuery} from "mongoose";
import {createModel} from "mongoose-gridfs";
import sharp_ from "sharp";
import {Asset, AssetDoc, IAsset, IAssetMeta} from "../models/asset";
import {bufferToStream} from "../utils";

const sharp = sharp_;

interface IConnection {
    write: (opts: any, stream: Readable, cb: Function) => void;
    unlink: (opts: any, cb: Function) => void;
    read: (opts: any) => Readable;
}

@Injectable()
export class Assets {

    private asset: IConnection;

    constructor() {
        this.asset = createModel({
            modelName: "Asset",
            connection
        });
    }

    write(stream: Readable, contentType: string, metadata: IAssetMeta = null): Promise<IAsset> {
        if (!contentType) {
            return Promise.reject(`Content type should be provided!`);
        }
        metadata = metadata || {};
        metadata.downloadCount = 0;
        metadata.lastDownload = null;
        metadata.filename = metadata.filename || new ObjectId().toHexString();
        return new Promise<IAsset>(((resolve, reject) => {
            this.asset.write({filename: metadata.filename, contentType, metadata}, stream, (error, file) => {
                if (error) {
                    return reject(error.message || error);
                }
                file.id = file._id.toHexString();
                resolve(file);
            });
        }));
    }

    async writeBuffer(buffer: Buffer, metadata: IAssetMeta = null, contentType: string = null): Promise<IAsset> {
        try {
            contentType = (contentType || (await fromBuffer(buffer)).mime).trim();
        } catch (e) {
            console.log(`Can't determine content type`, e);
        }
        if (contentType == "image/jpeg" || contentType == "image/jpg") {
            buffer = await sharp(buffer).rotate().toBuffer();
        }
        return this.write(bufferToStream(buffer), contentType, metadata);
    }

    async read(id: string): Promise<IAsset> {
        return this.find({_id: new ObjectId(id)});
    }

    async find(where: FilterQuery<AssetDoc>): Promise<IAsset> {
        const asset = await Asset.findOne(where);
        if (!asset) return null;
        asset.id = asset._id.toHexString();
        asset.stream = this.asset.read({_id: asset._id});
        asset.metadata.downloadCount = isNaN(asset.metadata.downloadCount) || !asset.metadata.lastDownload
            ? 1
            : asset.metadata.downloadCount + 1;
        asset.metadata.lastDownload = new Date();
        asset.markModified("metadata");
        await asset.save();
        return asset;
    }

    unlink(id: string): Promise<any> {
        return new Promise<string>(((resolve, reject) => {
            this.asset.unlink({_id: new ObjectId(id)}, (error) => {
                if (error) {
                    error = error.message || error;
                    if (error !== "not found") {
                        reject(error.message || error);
                        return;
                    }
                }
                resolve();
            });
        }));
    }
}
