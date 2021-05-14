import sharp_ from "sharp";
import {Readable} from "stream";
import {Collection, GridFSBucket} from "mongodb";
import {ObjectId} from "bson";
import fontkit_, {Font} from "fontkit";

import {FontFormat, IAsset, IAssetImageParams, IAssetMeta} from "../../common-types";
import {bufferToStream, deleteFromBucket, streamToBuffer} from "../../utils";

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

export class Asset implements IAsset {

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
        metadata.format = Asset.extractFontFormat(font);
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

    get id(): string {
        return this.fileId.toHexString();
    }

    get stream(): Readable {
        return this.bucket.openDownloadStream(this.fileId);
    }

    constructor(readonly fileId: ObjectId,
                readonly filename: string,
                readonly contentType: string,
                readonly metadata: IAssetMeta,
                protected bucket: GridFSBucket,
                protected collection: Collection) {
    }

    async unlink(): Promise<string> {
        return deleteFromBucket(this.bucket, this.fileId);
    }

    getBuffer(): Promise<Buffer> {
        return streamToBuffer(this.stream);
    }

    async download(metadata?: IAssetMeta): Promise<Readable> {
        metadata = Object.assign(this.metadata as IAssetMeta, metadata || {});
        metadata.downloadCount = isNaN(metadata.downloadCount) || !metadata.firstDownload
            ? 1
            : metadata.downloadCount + 1;
        metadata.firstDownload = metadata.firstDownload || new Date();
        metadata.lastDownload = new Date();
        await this.collection.updateOne({_id: this.fileId}, {$set: {metadata}});
        return this.stream;
    }

    async getImage(params: IAssetImageParams = null): Promise<Readable> {
        return Asset.toImage(this.stream, params);
    }

    async downloadImage(params?: IAssetImageParams, metadata?: IAssetMeta): Promise<Readable> {
        return Asset.toImage(await this.download(metadata), params);
    }

    toJSON(): any {
        return {
            id: this.id,
            filename: this.filename,
            contentType: this.contentType,
            metadata: this.metadata
        };
    }
}
