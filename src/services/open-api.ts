import {inject, singleton} from "tsyringe";
import {OpenAPIObject} from "openapi3-ts";
import {getMetadataArgsStorage} from "routing-controllers";
import {routingControllersToSpec} from "routing-controllers-openapi";
import {validationMetadatasToSchemas} from "class-validator-jsonschema";
import {defaultMetadataStorage} from "class-transformer/storage";
import {ValidationTypes} from "class-validator";
import {isFunction, isObject} from "../utils";
import {IsFile, IsObjectId} from "../validators";
import {OPENAPI_VALIDATION, OpenApiValidation} from "../common-types";

@singleton()
export class OpenApi {

    protected docs: OpenAPIObject;
    protected docsStr: string;

    get apiDocs(): OpenAPIObject {
        if (!this.docs) this.docs = this.createApiDocs();
        return this.docs;
    }

    get apiDocsStr(): string {
        if (!this.docsStr) this.docsStr = JSON.stringify(this.apiDocs);
        return this.docsStr;
    }

    constructor(@inject(OPENAPI_VALIDATION) protected customValidation: OpenApiValidation = null) {
        this.docs = null;
    }

    protected createApiDocs(): OpenAPIObject {
        const storage = getMetadataArgsStorage();
        const docs = routingControllersToSpec(storage);
        docs.basePath = "/api/";
        docs.definitions = validationMetadatasToSchemas({
            classTransformerMetadataStorage: defaultMetadataStorage,
            additionalConverters: {
                [ValidationTypes.CUSTOM_VALIDATION]: (meta, options) => {
                    const res = isFunction(this.customValidation) ? this.customValidation(meta, options) : this.customValidation;
                    if (isObject(res)) return res;
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
        docs.components.schemas = docs.definitions;
        return docs;
    }
}
