import {createSchema, ExtractDoc, ExtractProps, Type, typedModel} from "ts-mongoose";
import {Readable} from "stream";
import sharp_ from "sharp";
import {bufferToStream, streamToBuffer} from "../utils";

const sharp = sharp_;

const AssetSchema = createSchema(
    {
        filename: Type.string({ required: true }),
        contentType: Type.string({ required: true }),
        metadata: Type.mixed(),
        ...({} as {
            stream: Readable,
            getImage: (params?: IAssetImageParams) => Promise<Readable>
        })
    },
    {
        timestamps: false,
    }
);

AssetSchema.methods.getImage = async function (params: IAssetImageParams = null) {
    params = params || {};

    const asset = this as AssetDoc;
    if (Object.keys(params).length == 0) return asset.stream;
    let buffer = await streamToBuffer(asset.stream);

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

export const Asset = typedModel('Assets.file', AssetSchema);
export type AssetDoc = ExtractDoc<typeof AssetSchema>;

export interface IAssetMeta {
    filename?: string;
    classified?: boolean;
    downloadCount?: number;
    lastDownload?: Date;
    [prop: string]: any;
}

export interface IAsset extends AssetDoc {
    id?: string;
    metadata?: IAssetMeta;
}

export interface IAssetImageParams {
    rotation?: number;
    canvasScaleX?: number;
    canvasScaleY?: number;
    scaleX?: number;
    scaleY?: number;
}
