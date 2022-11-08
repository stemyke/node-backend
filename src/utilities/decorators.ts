import {getStatusCode, OpenAPI} from "routing-controllers-openapi";
import {ReferenceObject, SchemaObject} from "openapi3-ts";

export function IsDocumented(summary: string = null) {
    return OpenAPI(operation => {
        operation.summary = summary || operation.summary;
        operation.tags = ["Documented"].concat(operation.tags || []);
        return operation;
    });
}

export function JsonResponse(description: string = "Success", statusCode: number = null) {
    return OpenAPI((operation, route) => {
        const status = statusCode ?? getStatusCode(route) + "";
        operation.responses = operation.responses || {};
        operation.responses[status] = {
            description,
            content: {
                "application/json": {}
            }
        };
        return operation;
    });
}

export interface IResponseTypeOptions {
    description?: string;
    statusCode?: number;
    isArray?: boolean;
}

export function ResponseType(type: Function, options: IResponseTypeOptions = {}) {
    return OpenAPI((operation, route) => {
        const contentType = "application/json";
        const statusCode = options?.statusCode ?? getStatusCode(route) + "";
        const reference: ReferenceObject = {
            $ref: `#/components/schemas/${type.name}`,
        };
        const schema: SchemaObject = options.isArray
            ? { items: reference, type: "array" }
            : reference;
        operation.responses = operation.responses || {};
        operation.responses[statusCode] = {
            description: options.description || "Success",
            content: {
                [contentType]: {
                    schema
                }
            }
        };
        return operation;
    });
}
