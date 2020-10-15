import {createSchema, ExtractDoc, Type, typedModel} from "ts-mongoose";
import {IProgress} from "../common-types";
import {createTransformer, proxyFunction, proxyFunctions} from "../utils";
import {ProgressHelper} from "../services/progress-helper";

export const ProgressSchema = createSchema(
    {
        current: Type.number({required: true}),
        max: Type.number({required: true}),
        message: Type.string({required: false, default: ""}),
        error: Type.string({required: false, default: ""}),
        ...({} as IProgress),
    },
    {
        timestamps: true,
        toJSON: {
            transform: createTransformer((doc: any, ret: any, options?: any) => {
                ret.percent = doc.percent;
                return ret;
            })
        }
    }
);

ProgressSchema
    .virtual("percent")
    .get(proxyFunction("getPercent"))

proxyFunctions(ProgressSchema, ProgressHelper);

export const Progress = typedModel('Progress', ProgressSchema);
export type ProgressDoc = ExtractDoc<typeof ProgressSchema>;
