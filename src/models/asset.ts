import {createSchema, ExtractDoc, ExtractProps, Type, typedModel} from "ts-mongoose";
import {Readable} from "stream";

const AssetSchema = createSchema(
    {
        filename: Type.string({ required: true }),
        contentType: Type.string({ required: true }),
        metadata: Type.mixed(),
        ...({} as {
            stream: Readable
        })
    },
    {
        timestamps: false,
    }
);

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
