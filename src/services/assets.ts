import {Injectable} from "injection-js";
import {Duplex, Readable} from "stream";
import {ObjectId} from "bson";
import {connection, FilterQuery} from "mongoose";
import {createModel} from "mongoose-gridfs";
import sharp_ from "sharp";
import {Asset, AssetDoc, IAsset, IAssetMeta} from "../models/asset";

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

    async write(stream: Readable, contentType: string, metadata: IAssetMeta = null): Promise<IAsset> {
        metadata = metadata || {};
        metadata.downloadCount = metadata.downloadCount || 0;
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

    async writeBuffer(buffer: Buffer, contentType: string, meta: IAssetMeta = null): Promise<IAsset> {
        if ((contentType || "").startsWith("image")) {
            buffer = await sharp(buffer).rotate().toBuffer();
        }
        const stream = new Duplex();
        stream.push(buffer);
        stream.push(null);
        return this.write(stream, contentType, meta);
    }

    async read(id: string): Promise<IAsset> {
        return this.find({_id: new ObjectId(id)});
    }

    async find(where: FilterQuery<AssetDoc>): Promise<IAsset> {
        const asset = await Asset.findOne(where);
        if (!asset) return null;
        asset.id = asset._id.toHexString();
        asset.stream = this.asset.read({_id: asset._id});
        asset.metadata.downloadCount++;
        await asset.save();
        return asset;
    }

    unlink(id: string): Promise<any> {
        return new Promise<string>(((resolve, reject) => {
            this.asset.unlink({_id: new ObjectId(id)}, (error) => {
                if (error) {
                    return reject(error.message || error);
                }
                resolve();
            });
        }));
    }
}
