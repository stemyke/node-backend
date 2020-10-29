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
    const asset = this as AssetDoc;
    params = params || {};
    const paramKeys = Object.keys(params);
    if (paramKeys.length == 0) return asset.stream;
    let buffer = await streamToBuffer(asset.stream);
    const rotation = Math.round((params.rotation || 0) / 90) * 90;
    try {
        let sharpImg = sharp(buffer);
        const meta = await sharpImg.metadata();
        let width = meta.width;
        let height = meta.height;
        // Resize canvas
        if (!isNaN(params.canvasScaleX) || !isNaN(params.canvasScaleY)) {
            params.canvasScaleX = isNaN(params.canvasScaleX) ? 1 : params.canvasScaleX;
            params.canvasScaleY = isNaN(params.canvasScaleY) ? 1 : params.canvasScaleY;
            width *= params.canvasScaleX;
            height *= params.canvasScaleY;
            sharpImg.resize({width, height, background: "#00000000", fit: "contain"});
        }
        // Resize image
        if (!isNaN(params.scaleX) || !isNaN(params.scaleY)) {
            params.scaleX = isNaN(params.scaleX) ? 1 : params.scaleX;
            params.scaleY = isNaN(params.scaleY) ? 1 : params.scaleY;
            width *= params.scaleX;
            height *= params.scaleY;
            sharpImg.resize({width, height, background: "#00000000", fit: "fill"});
        }
        // Rotate
        if (!isNaN(rotation) && rotation !== 0) {
            sharpImg = sharpImg.rotate(rotation);
        }
        buffer = await sharpImg.toBuffer();
        return bufferToStream(buffer);
    } catch (e) {
        return asset.stream;
    }
}

export const Asset = typedModel('Assets.file', AssetSchema);
export type AssetDoc = ExtractDoc<typeof AssetSchema>;

export interface IAssetMeta {
    filename?: string;
    classified?: boolean;
    downloadCount?: number;
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
