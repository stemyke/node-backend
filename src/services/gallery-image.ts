import {v4 as uuidv4} from "uuid";
import sharp_ from "sharp";
import {IGalleryImage, IGallerySize, IGalleryImageHandler} from "../common-types";

const sharp = sharp_;
const bigSize = 1500;
const thumbSize = 250;

export class GalleryImage implements IGalleryImage {

    readonly thumb: string;
    readonly big: string;
    readonly targetSize: IGallerySize;

    constructor(readonly folder: string, size: IGallerySize, readonly handler: IGalleryImageHandler) {
        this.thumb = uuidv4();
        this.big = uuidv4();
        this.targetSize = !size ? {width: thumbSize, height: thumbSize} : size;
    }

    async serve(id: string): Promise<Buffer> {
        const isThumb = id == this.thumb;

        if (await this.handler.hasResult(isThumb)) {
            return this.handler.serveResult(isThumb);
        }

        const original = sharp(await this.handler.getOriginal()).rotate();
        const meta = await original.metadata();
        const ratio = meta.width / meta.height;
        const sizeRatio = isThumb ? this.targetSize.width / this.targetSize.height : 1;
        const size = isThumb ? Math.max(this.targetSize.width, this.targetSize.height) : bigSize;
        const targetHeight = ratio > sizeRatio ? size : Math.round(size / ratio);
        const targetWidth = Math.round(targetHeight * ratio);

        const resized = original.resize(targetWidth, targetHeight);
        const buffer = await (isThumb ? resized.extract({
            left: Math.floor((targetWidth - this.targetSize.width) / 2),
            top: Math.floor((targetHeight - this.targetSize.height) / 2),
            width: this.targetSize.width,
            height: this.targetSize.height
        }).toBuffer() : resized.toBuffer());

        await this.handler.writeResult(isThumb, buffer);
        return this.handler.serveResult(isThumb);
    }
}
