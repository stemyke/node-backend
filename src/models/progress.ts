import {createSchema, ExtractDoc, Type, typedModel} from "ts-mongoose";
import {IProgress} from "../common-types";
import {proxyFunction, proxyFunctions} from "../utils";
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
    }
);

ProgressSchema
    .virtual("percent")
    .get(proxyFunction("getPercent"))

proxyFunctions(ProgressSchema, ProgressHelper);

export const Progress = typedModel('Progress', ProgressSchema);
export type ProgressDoc = ExtractDoc<typeof ProgressSchema>;
