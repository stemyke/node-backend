import {Injectable} from "injection-js";
import {fromBuffer} from "file-type";
import {Readable} from "stream";
import {ObjectId} from "bson";
import {FilterQuery} from "mongoose";

import {bufferToStream} from "../utils";
import {IAsset, IAssetMeta} from "../common-types";
import {Asset, AssetDoc} from "../models/asset";
import {AssetHelper} from "./asset-helper";

@Injectable()
export class Assets {

    constructor(private helper: AssetHelper) {
    }

    write(stream: Readable, contentType: string, metadata: IAssetMeta = null): Promise<IAsset> {
        if (!contentType) {
            return Promise.reject(`Content type should be provided!`);
        }
        metadata = metadata || {};
        metadata.downloadCount = 0;
        metadata.firstDownload = null;
        metadata.lastDownload = null;
        metadata.filename = metadata.filename || new ObjectId().toHexString();
        return new Promise<IAsset>(((resolve, reject) => {
            this.helper.asset.write({filename: metadata.filename, contentType, metadata}, stream, (error, file) => {
                if (error) {
                    return reject(error.message || error);
                }
                this.read(file._id.toHexString()).then(resolve);
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
        if (AssetHelper.isImage(contentType)) {
            buffer = await AssetHelper.copyImageMeta(buffer, metadata);
        }
        if (AssetHelper.isFont(contentType)) {
            AssetHelper.copyFontMeta(buffer, metadata);
        }
        return this.write(bufferToStream(buffer), contentType, metadata);
    }

    async read(id: string): Promise<IAsset> {
        return this.find({_id: new ObjectId(id)});
    }

    async find(where: FilterQuery<AssetDoc>): Promise<IAsset> {
        return Asset.findOne(where);
    }

    async unlink(id: string): Promise<any> {
        const asset = await this.read(id);
        if (!asset) return null;
        return asset.unlink();
    }
}
