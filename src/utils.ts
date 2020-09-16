import {mkdir, readFile, unlink} from "fs";
import {Document, FilterQuery, Model, Schema} from "mongoose";
import {Injector, Type} from "injection-js";
import {PassThrough, Readable} from "stream";
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
        let query = model.find(where).sort(sort);
        return (limit > 0 ? query.skip(page * limit).limit(limit) : query).then(items => {
            return { count, items };
        });
    });
}

export function bufferToStream(buffer: Buffer): Readable {
    const readStream = new PassThrough();
    readStream.end(buffer);
    return readStream
}

export function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const concat = [];
        stream.on("data", data => {
            concat.push(data);
        });
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(concat)));
    })
}

export function mkdirRecursive(path: string, mode: number = null): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        mkdir(path, { mode: mode || 0o777, recursive: true }, err => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

export function readAndDeleteFile(path: string): Promise<Buffer> {
    return new Promise<Buffer>((res, rej) => {
        readFile(path, (err, data) => {
            if (err) {
                rej(err);
                return;
            }
            unlink(path, err => {
                if (err) {
                    rej(err);
                    return;
                }
                res(data);
            });
        });
    })
}

export function getFunctionParams(func: Function): string[] {
    // Remove comments of the form /* ... */
    // Removing comments of the form //
    // Remove body of the function { ... }
    // removing '=>' if func is arrow function
    const str = func.toString()
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/(.)*/g, '')
        .replace(/{[\s\S]*}/, '')
        .replace(/=>/g, '')
        .trim();

    // Start parameter names after first '('
    const start = str.indexOf("(") + 1;

    // End parameter names is just before last ')'
    const end = str.length - 1;
    const result = str.substring(start, end).split(", ");
    const params = [];

    result.forEach(element => {

        // Removing any default value
        element = element.replace(/=[\s\S]*/g, '').trim();

        if(element.length > 0)
            params.push(element);
    });

    return params;
}

export function proxyFunction(name: string): Function {
    return function() {
        const args = Array.from(arguments);
        args.unshift(this);
        return (this.helper[name] as Function).apply(this.helper, args);
    }
}

export function proxyFunctions(schema: Schema, helper: Type<any>, paramName: string = null): void {
    paramName = paramName || helper.prototype.constructor.name.toLowerCase().replace("helper", "");
    Object.getOwnPropertyNames(helper.prototype).forEach(name => {
        const func = helper.prototype[name];
        if (isFunction(func) && name !== "constructor") {
            const paramNames = getFunctionParams(func);
            if (paramNames[0] == paramName) {
                schema.methods[name] = proxyFunction(name);
            }
        }
    });
    injectServices(schema, {
        "helper": helper
    });
}
