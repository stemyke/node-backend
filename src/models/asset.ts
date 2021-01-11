import {createSchema, ExtractDoc, Type, typedModel} from "ts-mongoose";
import {createTransformer, proxyFunction, proxyFunctions} from "../utils";
import {IAsset} from "../common-types";
import {AssetHelper} from "../services/asset-helper";

const AssetSchema = createSchema(
    {
        filename: Type.string({ required: true }),
        contentType: Type.string({ required: true }),
        metadata: Type.mixed(),
        ...({} as IAsset)
    },
    {
        timestamps: false,
        toJSON: {
            transform: createTransformer()
        }
    }
);

AssetSchema
    .virtual("stream")
    .get(proxyFunction("getStream"))

proxyFunctions(AssetSchema, AssetHelper);

export const Asset = typedModel('Assets.file', AssetSchema);
export type AssetDoc = ExtractDoc<typeof AssetSchema>;
