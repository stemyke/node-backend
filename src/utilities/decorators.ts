import {OpenAPI} from "routing-controllers-openapi";

export function IsDocumented(summary: string = null) {
    return OpenAPI(operation => {
        operation.summary = summary || operation.summary;
        operation.tags = ["Documented"].concat(operation.tags || []);
        return operation;
    });
}
