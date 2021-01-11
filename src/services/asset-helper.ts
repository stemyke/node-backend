import {Injectable} from "injection-js";
import sharp_ from "sharp";
import {Readable} from "stream";
import {connection} from "mongoose";
import {createModel} from "mongoose-gridfs";
import fontkit_, {Font} from "fontkit";

import {FontFormat, IAssetConnection, IAssetImageParams, IAssetMeta} from "../common-types";
import {bufferToStream, streamToBuffer} from "../utils";
import {AssetDoc} from "../models/asset";

const sharp = sharp_;
const fontKit = fontkit_;

const fontTypes = [
    "application/font-woff", "application/font-woff2", "application/x-font-opentype", "application/x-font-truetype", "application/x-font-datafork",
    "font/woff", "font/woff2", "font/otf", "font/ttf", "font/datafork"
];

const imageTypes = ["image/jpeg", "image/jpg", "image/png"];

const fontProps = [
    "postscriptName", "fullName", "familyName", "subfamilyName",
    "copyright", "version", "unitsPerEm", "ascent", "descent", "lineGap",
    "underlinePosition", "underlineThickness", "italicAngle", "capHeight",
    "xHeight", "numGlyphs", "characterSet", "availableFeatures"
];

@Injectable()
export class AssetHelper {

    static isImage(contentType: string): boolean {
        return imageTypes.indexOf(contentType) >= 0;
    }

    static async copyImageMeta(buffer: Buffer, metadata: IAssetMeta): Promise<Buffer> {
        const output = await sharp(buffer).rotate().toBuffer({resolveWithObject: true});
        Object.assign(metadata, output.info);
        return output.data;
    }

    static isFont(contentType: string): boolean {
        return fontTypes.indexOf(contentType) >= 0;
    }

    static copyFontMeta(buffer: Buffer, metadata: IAssetMeta): void {
        const font: Font = fontKit.create(buffer);
        metadata.format = AssetHelper.extractFontFormat(font);
        fontProps.forEach(prop => {
            metadata[prop] = font[prop];
        });
    }

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

    private static async toImage(stream: Readable, params?: IAssetImageParams): Promise<Readable> {
        params = params || {};
        if (Object.keys(params).length == 0) return stream;
        let buffer = await streamToBuffer(stream);

        // Parse params
        params.rotation = isNaN(params.rotation) ? 0 : Math.round(params.rotation / 90) * 90;
        params.canvasScaleX = isNaN(params.canvasScaleX) ? 1 : params.canvasScaleX;
        params.canvasScaleY = isNaN(params.canvasScaleY) ? 1 : params.canvasScaleY;
        params.scaleX = isNaN(params.scaleX) ? 1 : params.scaleX;
        params.scaleY = isNaN(params.scaleY) ? 1 : params.scaleY;

        // Try to modify image
        try {
            // Get metadata
            const meta = await sharp(buffer).metadata();
            let width = meta.width;
            let height = meta.height;
            // Resize canvas
            if (params.canvasScaleX !== 1 || params.canvasScaleY !== 1) {
                width = Math.round(width * params.canvasScaleX);
                height = Math.round(height * params.canvasScaleY);
                buffer = await sharp(buffer)
                    .resize({width, height, background: "#00000000", fit: "contain"})
                    .toBuffer();
            }
            // Resize image
            if (params.scaleX !== 1 || params.scaleY !== 1) {
                width = Math.round(width * params.scaleX);
                height = Math.round(height * params.scaleY);
                buffer = await sharp(buffer)
                    .resize({width, height, background: "#00000000", fit: "fill"})
                    .toBuffer();
            }
            // Rotate
            if (params.rotation !== 0) {
                buffer = await sharp(buffer).rotate(params.rotation).toBuffer();
            }
            return bufferToStream(buffer);
        } catch (e) {
            return bufferToStream(buffer);
        }
    }

    readonly asset: IAssetConnection;

    constructor() {
        this.asset = createModel({
            modelName: "Asset",
            connection
        });
    }

    async unlink(asset: AssetDoc): Promise<any> {
        return new Promise<string>(((resolve, reject) => {
            this.asset.unlink({_id: asset._id}, (error) => {
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

    getStream(asset: AssetDoc): Readable {
        return this.asset.read({_id: asset._id});
    }

    async download(asset: AssetDoc, metadata?: IAssetMeta): Promise<Readable> {
        metadata = Object.assign(asset.metadata as IAssetMeta, metadata || {});
        metadata.downloadCount = isNaN(metadata.downloadCount) || !metadata.firstDownload
            ? 1
            : metadata.downloadCount + 1;
        metadata.firstDownload = metadata.firstDownload || new Date();
        metadata.lastDownload = new Date();
        asset.markModified("metadata");
        await asset.save();
        return asset.stream;
    }

    async getImage(asset: AssetDoc, params: IAssetImageParams = null): Promise<Readable> {
        return AssetHelper.toImage(asset.stream, params);
    }

    async downloadImage(asset: AssetDoc, params?: IAssetImageParams, metadata?: IAssetMeta): Promise<Readable> {
        return AssetHelper.toImage(await this.download(asset, metadata), params);
    }
}
