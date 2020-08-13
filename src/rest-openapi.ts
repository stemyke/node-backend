import {getMetadataArgsStorage} from "routing-controllers";
import {routingControllersToSpec} from "routing-controllers-openapi";
import {OpenAPIObject, SchemaObject} from "openapi3-ts";
import {defaultMetadataStorage} from "class-transformer/storage";
import {ValidationTypes} from "class-validator"
import {validationMetadatasToSchemas} from "class-validator-jsonschema"
import {SchemaConverter} from "./common-types";

let apiDocs: string = null;

export function getApiDocs(customValidation: SchemaConverter | SchemaObject): string {
    if (apiDocs) return apiDocs;
    const storage = getMetadataArgsStorage();
    const spec: OpenAPIObject = routingControllersToSpec(storage);
    spec.basePath = "/api/";
    spec.definitions = validationMetadatasToSchemas({
        classTransformerMetadataStorage: defaultMetadataStorage,
        additionalConverters: {
            [ValidationTypes.CUSTOM_VALIDATION]: customValidation || (() => null)
        }
    });
    spec.components.schemas = spec.definitions;
    apiDocs = JSON.stringify(spec);
    return apiDocs;
}
