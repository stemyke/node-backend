import {createSchema, ExtractDoc, Type, typedModel} from "ts-mongoose";
import {createTransformer, proxyFunctions} from "../utils";
import {ILazyAsset} from "../common-types";
import {LazyAssetHelper} from "../services/lazy-asset-helper";

const LazyAssetSchema = createSchema(
    {

        progressId: Type.string({ required: false }),
        assetId: Type.string({ required: false }),
        ...({} as ILazyAsset)
    },
    {
        timestamps: false,
        toJSON: {
            transform: createTransformer()
        }
    }
);

proxyFunctions(LazyAssetSchema, LazyAssetHelper);

export const LazyAsset = typedModel('LazyAsset', LazyAssetSchema);
export type LazyAssetDoc = ExtractDoc<typeof LazyAssetSchema>;
