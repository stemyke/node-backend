import {injectable, Lifecycle, scoped} from "tsyringe";
import fontKit_, {Font} from "fontkit";
import {fromBuffer} from "file-type";
import sharp_ from "sharp";
import {FontFormat, IAssetMeta, IFileType} from "../common-types";

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

    private static checkTextFileType(type: IFileType): boolean {
        console.log("SHOULD CONVERT", type.mime, type.mime.indexOf("text") >= 0 || type.mime.indexOf("xml") >= 0);
        return type.mime.indexOf("text") >= 0 || type.mime.indexOf("xml") >= 0;
    }

    private static fixTextFileType(type: IFileType, buffer: Buffer): IFileType {
        const text = buffer.toString("utf8");
        console.log("IS SVG", text);
        if (text.indexOf("<svg") >= 0) {
            return {ext: "svg", mime: "image/svg+xml"};
        }
        return type;
    }

    static async fileTypeFromBuffer(buffer: Buffer): Promise<IFileType> {
        const type = (await fromBuffer(buffer) ?? {ext: "txt", mime: "text/plain"}) as IFileType;
        if (AssetProcessor.checkTextFileType(type)) {
            return AssetProcessor.fixTextFileType(type, buffer);
        }
        return type;
    }

    static async getMimeType(buffer: Buffer, mimeType?: string): Promise<string> {
        try {
            mimeType = (await AssetProcessor.fileTypeFromBuffer(buffer)).mime;
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

    async process(buffer: Buffer, metadata: IAssetMeta, fileType: IFileType): Promise<Buffer> {
        if (AssetProcessor.isImage(fileType.mime)) {
            buffer = await AssetProcessor.copyImageMeta(buffer, metadata);
        }
        if (AssetProcessor.isFont(fileType.mime)) {
            AssetProcessor.copyFontMeta(buffer, metadata);
        }
        return buffer;
    }
}
