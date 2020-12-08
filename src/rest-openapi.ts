import {getMetadataArgsStorage} from "routing-controllers";
import {routingControllersToSpec} from "routing-controllers-openapi";
import {OpenAPIObject, SchemaObject} from "openapi3-ts";
import {defaultMetadataStorage} from "class-transformer/storage";
import {ValidationTypes} from "class-validator"
import {validationMetadatasToSchemas} from "class-validator-jsonschema"
import {SchemaConverter} from "./common-types";
import {isFunction} from "./utils";
import {IsFile, IsObjectId} from "./validators";

let apiDocs: string = null;

export function getApiDocs(customValidation: SchemaConverter | SchemaObject): string {
    if (apiDocs) return apiDocs;
    const storage = getMetadataArgsStorage();
    const spec: OpenAPIObject = routingControllersToSpec(storage);
    spec.basePath = "/api/";
    spec.definitions = validationMetadatasToSchemas({
        classTransformerMetadataStorage: defaultMetadataStorage,
        additionalConverters: {
            [ValidationTypes.CUSTOM_VALIDATION]: (meta, options) => {
                const res = isFunction(customValidation) ? customValidation(meta, options) : customValidation;
                if (!!res) return res;
                const constraints = meta.constraints || [];
                if (meta.constraintCls === IsFile) {
                    return {
                        multi: constraints[0] || false,
                        type: "file"
                    }
                }
                if (meta.constraintCls === IsObjectId) {
                    return {
                        endpoint: constraints[0] || false,
                        multi: constraints[1] || false,
                        type: "list"
                    }
                }
                return null;
            }
        }
    });
    spec.components.schemas = spec.definitions;
    apiDocs = JSON.stringify(spec);
    return apiDocs;
}
