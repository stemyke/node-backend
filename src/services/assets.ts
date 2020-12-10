import {Injectable} from "injection-js";
import {fromBuffer} from "file-type";
import {Readable} from "stream";
import {ObjectId} from "bson";
import {connection, FilterQuery} from "mongoose";
import {createModel} from "mongoose-gridfs";
import {Font} from "fontkit";
import sharp_ from "sharp";
import fontkit_ from "fontkit";

import {bufferToStream} from "../utils";
import {FontFormat, IAsset, IAssetConnection, IAssetMeta} from "../common-types";
import {Asset, AssetDoc} from "../models/asset";

const sharp = sharp_;
const fontKit = fontkit_;
const imageTypes = ["image/jpeg", "image/jpg", "image/png"];
const fontTypes = [
    "application/font-woff", "application/font-woff2", "application/x-font-opentype", "application/x-font-truetype", "application/x-font-datafork",
    "font/woff", "font/woff2", "font/otf", "font/ttf", "font/datafork"
];
const fontProps = [
    "postscriptName", "fullName", "familyName", "subfamilyName",
    "copyright", "version", "unitsPerEm", "ascent", "descent", "lineGap",
    "underlinePosition", "underlineThickness", "italicAngle", "capHeight",
    "xHeight", "numGlyphs", "characterSet", "availableFeatures"
];

@Injectable()
export class Assets {

    static extractFontFormat(font: Font): FontFormat {
        const name: string = font.constructor.name;
        const tag: string  = font["directory"].tag;
        switch (name) {
            case "TTFFont":
                return tag === "OTTO" ? "opentype" : "truetype";
            case "WOFF2Font":
                return "woff2";
            case "WOFFFont":
                return "woff";
            case "DFont":
                return "datafork";
        }
        return null;
    }

    private asset: IAssetConnection;

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
        if (imageTypes.indexOf(contentType) >= 0) {
            const output = await sharp(buffer).rotate().toBuffer({resolveWithObject: true});
            buffer = output.data;
            metadata = metadata || {};
            Object.assign(metadata, output.info);
        }
        if (fontTypes.indexOf(contentType) >= 0) {
            const font: Font = fontKit.create(buffer);
            metadata = metadata || {};
            metadata.format = Assets.extractFontFormat(font);
            fontProps.forEach(prop => {
                metadata[prop] = font[prop];
            });
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
        const metadata = asset.metadata as IAssetMeta;
        metadata.downloadCount = isNaN(metadata.downloadCount) || !metadata.lastDownload
            ? 1
            : metadata.downloadCount + 1;
        metadata.lastDownload = new Date();
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
