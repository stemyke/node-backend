import {Document, FilterQuery, Model, Schema} from "mongoose";
import {Injector} from "injection-js";
import {IPagination} from "./common-types";

export function isNullOrUndefined(value: any): boolean {
    return value == null || typeof value == "undefined";
}

export function isDefined(value: any): boolean {
    return !isNullOrUndefined(value);
}

export function getType(obj: any): string {
    const regex = new RegExp("\\s([a-zA-Z]+)");
    return Object.prototype.toString.call(obj).match(regex)[1].toLowerCase();
}

export function isObject(value: any): boolean {
    return getType(value) == "object";
}

export function isString(value: any): value is string {
    return typeof value === "string";
}

export function isFunction(value: any): value is Function {
    return typeof value === "function";
}

export function getValue(obj: any, key: string, defaultValue?: any, treeFallback: boolean = false): any {
    key = key || "";
    const keys = key.split(".");
    let curKey = "";
    do {
        curKey += keys.shift();
        if (isDefined(obj) && isDefined(obj[curKey]) && (typeof obj[curKey] === "object" || !keys.length)) {
            obj = obj[curKey];
            curKey = "";
        } else if (!keys.length) {
            defaultValue = typeof defaultValue == "undefined" ? key.replace(new RegExp(`${curKey}$`), `{${curKey}}`) : defaultValue;
            obj = treeFallback ? obj || defaultValue : defaultValue;
        } else {
            curKey += ".";
        }
    } while (keys.length);
    return obj;
}

export function groupBy<T>(items: T[], cb: (item: T) => string) {
    return items.reduce((res, item) => {
        const group = cb(item);
        res[group] = res[group] || [];
        res[group].push(item);
        return res;
    }, {});
}

export function convertValue(value: any, type: string): any {
    switch (type) {
        case "boolean":
            value = typeof value == "string" ? value.toLowerCase() : value;
            return (value == "no" || value == "false" || value == "0") ? false : !!value;
        case "number":
            const val = parseFloat(value);
            return isNaN(val) ? 0 : val;
    }
    return value;
}

export function injectServices(schema: Schema<any>, services: {[prop: string]: any}) {
    const serviceMap: {[prop: string]: any} = {};
    Object.keys(services).forEach(prop => {
        schema
            .virtual(prop)
            .get(() => {
                const injector = Injector["appInjector"] as Injector;
                serviceMap[prop] = serviceMap[prop] || (!injector ? {} : injector.get(services[prop]));
                return serviceMap[prop];
            });
    });
}

export function paginate<T extends Document>(model: Model<T>, where: FilterQuery<T>, page: number, limit: number, sort: string = null): Promise<IPagination> {
    return model.countDocuments(where).then(count => {
        let query = this.type.find(where).sort(sort);
        return (limit > 0 ? query.skip(page * limit).limit(limit) : query).then(items => {
            return { count, items };
        });
    });
}
