import {inject, singleton} from "tsyringe";
import {OpenAPIObject, ReferenceObject, SchemaObject} from "openapi3-ts";
import {getMetadataArgsStorage} from "routing-controllers";
import {routingControllersToSpec} from "routing-controllers-openapi";
import {defaultMetadataStorage} from "class-transformer/cjs/storage";
import {validationMetadatasToSchemas} from "class-validator-jsonschema";
import {ValidationTypes} from "class-validator";
import {isDefined, isFunction, isObject} from "../utils";
import {IsFile, IsObjectId} from "../validators";
import {DI_CONTAINER, IDependencyContainer, IRequest, OPENAPI_VALIDATION, OpenApiValidation} from "../common-types";

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

    constructor(@inject(DI_CONTAINER) protected container: IDependencyContainer,
                @inject(OPENAPI_VALIDATION) protected customValidation: OpenApiValidation) {
        this.docs = null;
    }

    async schemaToExample(src: ReferenceObject | SchemaObject, req?: IRequest): Promise<any> {
        const maybeRef = src as ReferenceObject;
        if (maybeRef.$ref) {
            const schemas = this.apiDocs.components.schemas;
            const schema = maybeRef.$ref
                .replace("#/components/schemas/", "")
                .replace("#/definitions/", "");
            return this.schemaToExample(schemas[schema], req);
        }
        let schema = src as SchemaObject;
        if (schema.oneOf) {
            schema = Object.assign({}, schema, schema.oneOf[0]);
        }
        if (schema.type === "object") {
            const result = {};
            await Promise.all(Object.keys(schema.properties).map(async key => {
                result[key] = await this.schemaToExample(schema.properties[key], req);
            }));
            return result;
        }
        if (schema.type === "array") {
            return [await this.schemaToExample(schema.items, req)];
        }
        if (schema.type === "string") {
            if (isDefined(schema.default)) {
                if (isFunction(schema.default)) {
                    return schema.default(this.container);
                }
                return schema.default;
            }
            if (schema.format == "date") {
                return new Date().toISOString().substr(0, 10);
            }
            if (schema.format == "date-time") {
                return new Date().toISOString();
            }
            if (schema.enum) {
                return schema.enum[0];
            }
            return "string";
        }
        if (schema.type === "number") {
            return schema.default ?? 0;
        } else if (schema.type === "boolean") {
            return schema.default ?? false;
        } else {
            return schema.default ?? null;
        }
    }

    protected createApiDocs(): OpenAPIObject {
        const storage = getMetadataArgsStorage();
        const docs = routingControllersToSpec(storage, {}, {
            components: {
                schemas: validationMetadatasToSchemas({
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
                                } as any;
                            }
                            if (meta.constraintCls === IsObjectId) {
                                return {
                                    endpoint: constraints[0] || false,
                                    multi: constraints[1] || false,
                                    type: "list"
                                } as any;
                            }
                            return null;
                        }
                    }
                })
            }
        });
        return docs;
    }
}
