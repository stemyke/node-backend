import sharp_, {Region} from "sharp";
import {Readable} from "stream";
import {Collection, GridFSBucket} from "mongodb";
import {ObjectId} from "bson";

import {IAsset, IAssetCropInfo, IAssetImageParams, IAssetMeta} from "../../common-types";
import {bufferToStream, deleteFromBucket, isBoolean, isInterface, isString, streamToBuffer} from "../../utils";
import {BaseEntity} from "./base-entity";

const sharp = sharp_;
const cropInterface = {
    x: "number",
    y: "number",
    w: "number",
    h: "number"
};

export class Asset extends BaseEntity<IAsset> implements IAsset {

    static toCropRegion(cropInfo: string | IAssetCropInfo): Region {
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

    static async toImage(stream: Readable, meta?: IAssetMeta, params?: IAssetImageParams): Promise<Readable> {
        params = params || {};

        // Get default crop info
        const crop = Asset.toCropRegion(meta.crop);

        // Return the stream if there is no params and no default crop exists
        if (meta?.extension === "svg" || (Object.keys(params).length == 0 && !crop)) {
            return stream;
        }

        // Parse params
        params.rotation = isNaN(params.rotation) ? 0 : Math.round(params.rotation / 90) * 90;
        params.canvasScaleX = isNaN(params.canvasScaleX) ? 1 : Number(params.canvasScaleX);
        params.canvasScaleY = isNaN(params.canvasScaleY) ? 1 : Number(params.canvasScaleY);
        params.scaleX = isNaN(params.scaleX) ? 1 : Number(params.scaleX);
        params.scaleY = isNaN(params.scaleY) ? 1 : Number(params.scaleY);
        params.crop = isBoolean(params.crop) ? params.crop : params.crop == "true";

        // Try to modify image
        let buffer = await streamToBuffer(stream);
        try {
            // Get crop info
            const cropBefore = Asset.toCropRegion(params.cropBefore || (params.crop ? meta.cropBefore : null));
            const cropAfter = Asset.toCropRegion(params.cropAfter || (params.crop ? meta.cropAfter : null));
            // Get metadata
            let img = sharp(buffer);
            let {width, height} = await img.metadata();
            // Crop before resize
            if (cropBefore) {
                width = cropBefore.width;
                height = cropBefore.height;
                img = img.extract(cropBefore);
            } else if (crop) {
                width = crop.width;
                height = crop.height;
                img = img.extract(crop);
            }
            // Resize canvas
            const canvasScaleX = meta?.canvasScaleX || 1;
            const canvasScaleY = meta?.canvasScaleY || 1;
            if (params.canvasScaleX !== canvasScaleX || params.canvasScaleY !== canvasScaleY) {
                width = Math.round(width * params.canvasScaleX);
                height = Math.round(height * params.canvasScaleY);
                img = img.resize({width, height, background: "#00000000", fit: "contain"});
            }
            // Resize image
            if (params.scaleX !== 1 || params.scaleY !== 1) {
                width = Math.round(width * params.scaleX);
                height = Math.round(height * params.scaleY);
                img = img.resize({width, height, background: "#00000000", fit: "fill"});
            }
            // Crop after resize
            if (cropAfter) {
                img = img.extract(cropAfter);
            }
            // Rotate
            if (params.rotation !== 0) {
                buffer = await img.toBuffer();
                img = sharp(buffer).rotate(params.rotation);
            }
            return bufferToStream(await img.toBuffer());
        } catch (e) {
            console.log("Asset image conversion error", e);
            return bufferToStream(buffer);
        }
    }

    get filename(): string {
        return this.data.filename;
    }

    get contentType(): string {
        return this.data.contentType;
    }

    get metadata(): IAssetMeta {
        return this.data.metadata;
    }

    get stream(): Readable {
        return this.bucket.openDownloadStream(this.mId);
    }

    constructor(id: ObjectId,
                data: Partial<IAsset>,
                collection: Collection,
                protected bucket: GridFSBucket) {
        super(id, data, collection);
    }

    async unlink(): Promise<string> {
        return deleteFromBucket(this.bucket, this.mId);
    }

    getBuffer(): Promise<Buffer> {
        return streamToBuffer(this.stream);
    }

    async download(metadata?: IAssetMeta): Promise<Readable> {
        metadata = Object.assign(this.metadata, metadata || {});
        metadata.downloadCount = isNaN(metadata.downloadCount) || !metadata.firstDownload
            ? 1
            : metadata.downloadCount + 1;
        metadata.firstDownload = metadata.firstDownload || new Date();
        metadata.lastDownload = new Date();
        await this.collection.updateOne({_id: this.mId}, {$set: {metadata}});
        return this.stream;
    }

    async getImage(params: IAssetImageParams = null): Promise<Readable> {
        return Asset.toImage(this.stream, this.metadata, params);
    }

    async downloadImage(params?: IAssetImageParams, metadata?: IAssetMeta): Promise<Readable> {
        return Asset.toImage(await this.download(metadata), this.metadata, params);
    }
}
