import {injectable, Lifecycle, scoped} from "tsyringe";
import fontKit_, {Font} from "fontkit";
import {fromBuffer} from "file-type";
import sharp_ from "sharp";
import {FontFormat, IAssetMeta} from "../common-types";

const sharp = sharp_;
const fontKit = fontKit_;

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

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class AssetProcessor {

    static async getMimeType(buffer: Buffer, mimeType?: string): Promise<string> {
        try {
            mimeType = (await fromBuffer(buffer)).mime;
        } catch (e) {
            if (!mimeType) {
                throw `Can't determine mime type`;
            }
            console.log(`Can't determine mime type`, e);
        }
        return mimeType;
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
        metadata.format = AssetProcessor.extractFontFormat(font);
        fontProps.forEach(prop => {
            metadata[prop] = font[prop];
        });
    }

    async process(buffer: Buffer, metadata: IAssetMeta, contentType: string): Promise<Buffer> {
        if (AssetProcessor.isImage(contentType)) {
            buffer = await AssetProcessor.copyImageMeta(buffer, metadata);
        }
        if (AssetProcessor.isFont(contentType)) {
            AssetProcessor.copyFontMeta(buffer, metadata);
        }
        return buffer;
    }
}
