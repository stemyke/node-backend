import {OpenAPI} from "routing-controllers-openapi";

export function IsDocumented() {
    return OpenAPI(operation => {
        operation.tags = ["Documented"].concat(operation.tags || []);
        return operation;
    });
}
