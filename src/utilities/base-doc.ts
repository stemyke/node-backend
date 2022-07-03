import {RefType, Types} from "mongoose";
import {DocumentType, getModelForClass, ReturnModelType} from "@typegoose/typegoose";
import {Constructor} from "../common-types";

export abstract class BaseDoc<IDType extends RefType = Types.ObjectId> {

    _id?: IDType;

    /**
     * This getter/setter doesn't exist if "schemaOptions.id" being set to "false"
     */
    id?: string;

    /**
     * This getter doesn't exist if "schemaOptions.timestamps" being set to "false"
     */
    createdAt?: Date;

    /**
     * This getter doesn't exist if "schemaOptions.timestamps" being set to "false"
     */
    updatedAt?: Date;

    /**
     * Returns the Document as JSON
     */
    toJSON?(): any;

    /**
     * Returns the Document as an Object
     */
    toObject?(): any;

    /**
     * Casts this to DocumentType<this> to allow using document methods in get/set-s
     */
    cast(): DocumentType<this> {
        return this as any;
    }

    /**
     * Gets a pre-compiled model from typegoose cache by its class type
     * @param type
     */
    model<T extends Constructor<any>>(type: T): ReturnModelType<T> {
        return getModelForClass(type);
    }
}

export type PrimitiveArray<T> = Types.Array<T>;

export const PrimitiveArray = Types.Array;

export type DocumentArray<T extends BaseDoc> = Types.DocumentArray<DocumentType<T>>;

export const DocumentArray = Types.DocumentArray;
