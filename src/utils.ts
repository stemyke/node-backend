import {Model} from "mongoose";
import {Provider} from "injection-js";

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

export function injectServices(model: Model<any>, providers: {[prop: string]: Provider}) {
    Reflect.defineMetadata("injected-services", providers, model);
}
