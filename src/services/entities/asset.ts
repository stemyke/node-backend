import sharp_, {Region} from "sharp";
import {Readable} from "stream";
import {Collection, GridFSBucket} from "mongodb";
import {ObjectId} from "bson";

import {IAsset, IAssetCropInfo, IAssetImageParams, IAssetMeta} from "../../common-types";
import {bufferToStream, deleteFromBucket, isBoolean, isInterface, isString, streamToBuffer} from "../../utils";

const sharp = sharp_;
const cropInterface = {
    x: "number",
    y: "number",
    w: "number",
    h: "number"
};

export class Asset implements IAsset {

    protected static toCropRegion(cropInfo: string | IAssetCropInfo): Region {
        let crop = cropInfo as IAssetCropInfo;
        if (isString(cropInfo)) {
            try {
                crop = JSON.parse(cropInfo as string);
            } catch (e) {
                return null;
            }
        }
        if (!isInterface(crop, cropInterface)) return null;
        return {
            width: Math.round(crop.w),
            height: Math.round(crop.h),
            top: Math.round(crop.y),
            left: Math.round(crop.x)
        };
    }

    protected static async toImage(stream: Readable, meta?: IAssetMeta, params?: IAssetImageParams): Promise<Readable> {
        params = params || {};
        if (Object.keys(params).length == 0) return stream;
        let buffer = await streamToBuffer(stream);

        // Parse params
        params.rotation = isNaN(params.rotation) ? 0 : Math.round(params.rotation / 90) * 90;
        params.canvasScaleX = isNaN(params.canvasScaleX) ? 1 : params.canvasScaleX;
        params.canvasScaleY = isNaN(params.canvasScaleY) ? 1 : params.canvasScaleY;
        params.scaleX = isNaN(params.scaleX) ? 1 : params.scaleX;
        params.scaleY = isNaN(params.scaleY) ? 1 : params.scaleY;
        params.crop = isBoolean(params.crop) ? params.crop : params.crop == "true";

        // Try to modify image
        try {
            // Get crop info
            const crop = Asset.toCropRegion(meta.crop);
            const cropBefore = Asset.toCropRegion(params.cropBefore || (params.crop ? meta.cropBefore : null));
            const cropAfter = Asset.toCropRegion(params.cropAfter || (params.crop ? meta.cropAfter : null));
            // Get metadata
            const imgMeta = await sharp(buffer).metadata();
            let width = imgMeta.width;
            let height = imgMeta.height;
            // Crop before resize
            if (cropBefore) {
                buffer = await sharp(buffer)
                    .extract(cropBefore)
                    .toBuffer();
                width = cropBefore.width;
                height = cropBefore.height;
            } else if (crop) {
                buffer = await sharp(buffer)
                    .extract(crop)
                    .toBuffer();
                width = crop.width;
                height = crop.height;
            }
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
            // Crop after resize
            if (cropAfter) {
                buffer = await sharp(buffer)
                    .extract(cropAfter)
                    .toBuffer();
            }
            // Rotate
            if (params.rotation !== 0) {
                buffer = await sharp(buffer).rotate(params.rotation).toBuffer();
            }
            return bufferToStream(buffer);
        } catch (e) {
            console.log("Asset image conversion error", e);
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
        return Asset.toImage(this.stream, this.metadata, params);
    }

    async downloadImage(params?: IAssetImageParams, metadata?: IAssetMeta): Promise<Readable> {
        return Asset.toImage(await this.download(metadata), this.metadata, params);
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
