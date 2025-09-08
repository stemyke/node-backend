import {getStatusCode, OpenAPI} from "routing-controllers-openapi";
import {ParameterObject, ReferenceObject} from "openapi3-ts";

export function IsDocumented(summary: string = null, paramDescriptions: {[name: string]: string} = {}) {
    return OpenAPI(op => {
        op.summary = summary || op.summary;
        op.tags = ["Documented"].concat(op.tags || []);
        op.parameters?.forEach(p => {
            if ((p as ReferenceObject)?.$ref) return;
            const schema = p as ParameterObject;
            schema.description = paramDescriptions[schema.name]
                || schema.description
                || `param.${op.operationId}.${schema.name}`.toLowerCase();
        });
        return op;
    });
}

export function JsonResponse(description: string = "Success", statusCode: number = null) {
    return OpenAPI((op, route) => {
        const status = statusCode ?? getStatusCode(route) + "";
        op.responses = op.responses || {};
        op.responses[status] = {
            description,
            content: {
                "application/json": {}
            }
        };
        return op;
    });
}

export interface IResponseTypeOptions {
    description?: string;
    statusCode?: number;
    isArray?: boolean;
}

export function ResponseType(type: Function, options: IResponseTypeOptions = {}) {
    return OpenAPI((op, route) => {
        const contentType = "application/json";
        const statusCode = options?.statusCode ?? getStatusCode(route) + "";
        const reference: ReferenceObject = {
            $ref: `#/components/schemas/${type.name}`,
        };
        op.responses = op.responses || {};
        op.responses[statusCode] = {
            description: options.description || "Success",
            content: {
                [contentType]: {
                    schema: options.isArray
                        ? { items: reference, type: "array" }
                        : reference
                }
            }
        };
        return op;
    });
}
