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
            getImage: (rotation?: number) => Promise<Readable>
        })
    },
    {
        timestamps: false,
    }
);

AssetSchema.methods.getImage = async function (rotation: number = 0) {
    const asset = this as AssetDoc;
    if (!rotation) return asset.stream;
    let buffer = await streamToBuffer(asset.stream);
    rotation = Math.round(rotation / 90) * 90;
    try {
        buffer = await sharp(buffer).rotate(rotation).toBuffer();
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
