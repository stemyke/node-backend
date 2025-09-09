import {injectable, Lifecycle, scoped} from "tsyringe";
import {create as createFont} from "fontkit";
import sharp from "sharp";
import type {Font} from "fontkit";
import {FontFormat, IAssetMeta, IFileType} from "../common-types";

const fontTypes = [
    "application/font-woff", "application/font-woff2", "application/x-font-opentype", "application/x-font-truetype", "application/x-font-datafork",
    "font/woff", "font/woff2", "font/otf", "font/ttf", "font/datafork"
];

const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/svg+xml"];

const fontProps = [
    "postscriptName", "fullName", "familyName", "subfamilyName",
    "copyright", "version", "unitsPerEm", "ascent", "descent", "lineGap",
    "underlinePosition", "underlineThickness", "italicAngle", "capHeight",
    "xHeight", "numGlyphs", "characterSet", "availableFeatures"
];

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class AssetProcessor {

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

    static async copyImageMeta(buffer: Buffer, metadata: IAssetMeta, fileType: IFileType): Promise<Buffer> {
        if (fileType.mime === "image/svg+xml") {
            const match = /<svg([^<>]+)>/gi.exec(buffer.toString("utf8"));
            if (match && match.length > 1) {
                const attrs = match[1].match(/([a-z]+)="([^"]+)"/gi);
                attrs.forEach(attr => {
                    if (attr.length < 5) return;
                    const [name, value] = attr.split("=");
                    const val = value.replace(/"/gi, "") as any;
                    metadata[name] = isNaN(val) ? val : Number(val);
                });
                if (metadata.viewBox && (isNaN(metadata.width) || isNaN(metadata.height))) {
                    const parts = (metadata.viewBox as string).split(" ");
                    metadata.width = Number(parts[0]) + Number(parts[2]);
                    metadata.height = Number(parts[1]) + Number(parts[3]);
                }
                if (!isNaN(metadata.width) && !isNaN(metadata.height)) {
                    metadata.svgSize = {x: metadata.width, y: metadata.height};
                }
            }
            return buffer;
        }
        const output = await sharp(buffer).rotate().toBuffer({resolveWithObject: true});
        Object.assign(metadata, output.info);
        return output.data;
    }

    static isFont(contentType: string): boolean {
        return fontTypes.indexOf(contentType) >= 0;
    }

    static copyFontMeta(buffer: Buffer, metadata: IAssetMeta): void {
        const font = createFont(buffer) as Font;
        metadata.format = AssetProcessor.extractFontFormat(font);
        fontProps.forEach(prop => {
            metadata[prop] = font[prop];
        });
    }

    async process(buffer: Buffer, metadata: IAssetMeta, fileType: IFileType): Promise<Buffer> {
        if (AssetProcessor.isImage(fileType.mime)) {
            buffer = await AssetProcessor.copyImageMeta(buffer, metadata, fileType);
        }
        if (AssetProcessor.isFont(fileType.mime)) {
            AssetProcessor.copyFontMeta(buffer, metadata);
        }
        return buffer;
    }
}
