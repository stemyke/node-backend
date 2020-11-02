import {mkdir, readFile as fsReadFile, unlink, writeFile as fsWriteFile} from "fs";
import {basename, dirname} from "path";
import {Document, DocumentQuery, FilterQuery, Model, Schema} from "mongoose";
import {Injector, Type} from "injection-js";
import {PassThrough, Readable} from "stream";
import {ObjectId} from "bson";
import {Action, BadRequestError, createParamDecorator, HttpError} from "routing-controllers";
import {IClientSocket, IPaginationBase, IProgress, IRequest} from "./common-types";
import {Server} from "socket.io";

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

export function isArray(value: any): value is Array<any> {
    return Array.isArray(value);
}

export function isString(value: any): value is string {
    return typeof value === "string";
}

export function isFunction(value: any): value is Function {
    return typeof value === "function";
}

export function ucFirst(value: string): string {
    if (!value) return "";
    return value[0].toUpperCase() + value.substr(1);
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
        case "array":
            return `${value}`.split(", ");
    }
    return value;
}

export function injectServices(schema: Schema<any>, services: { [prop: string]: any }) {
    const serviceMap: { [prop: string]: any } = {};
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

export function paginate<T extends Document>(model: Model<T>, where: FilterQuery<T>, page: number, limit: number, sort: string = null): Promise<IPaginationBase<T>> {
    return model.countDocuments(where).then(count => {
        let query = model.find(where).sort(sort);
        return (limit > 0 ? query.skip(page * limit).limit(limit) : query).then(items => {
            const meta = {total: count};
            return {count, items, meta};
        });
    });
}

export async function paginateAggregations<T extends Document>(model: Model<T>, aggregations: any[], page: number, limit: number, sort: string = null): Promise<IPaginationBase<T>> {
    const sortField = !isString(sort) || !sort ? null : (sort.startsWith("-") ? sort.substr(1) : sort);
    const sortAggregation = !sortField ? [] : [{
        $sort: {[sortField]: sortField == sort ? 1 : -1}
    }];
    const result = await model.aggregate([
        ...aggregations,
        ...sortAggregation,
        {
            $group: {
                _id: "results",
                result: {$push: "$$CURRENT"}
            }
        },
        {
            $project: {
                _id: 0,
                items: limit > 0 ? {$slice: ["$result", page * limit, limit]} : "$result",
                count: {$size: "$result"},
                "meta.total": {$size: "$result"},
            }
        }
    ]);
    const pagination = result[0] as IPaginationBase<T>;
    if (!pagination) {
        return {items: [], count: 0, meta: {total: 0}};
    }
    pagination.items = pagination.items.map(i => model.hydrate(i));
    return pagination;
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
        mkdir(path, {mode: mode || 0o777, recursive: true}, err => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

export function deleteFile(path: string): Promise<any> {
    return new Promise<Buffer>((resolve, reject) => {
        unlink(path, err => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

export function readFile(path: string): Promise<Buffer> {
    return new Promise<Buffer>((res, rej) => {
        fsReadFile(path, (err, data) => {
            if (err) {
                rej(err);
                return;
            }
            res(data);
        });
    });
}

export async function readAndDeleteFile(path: string, timeout: number = 5000): Promise<Buffer> {
    const data = await readFile(path);
    setTimeout(() => {
        unlink(path, () => {
        });
    }, timeout);
    return data;
}

export async function writeFile(path: string, data: Buffer): Promise<Buffer> {
    await mkdirRecursive(dirname(path));
    return new Promise<Buffer>((res, rej) => {
        fsWriteFile(path, data, err => {
            if (err) {
                rej(err);
                return;
            }
            res(data);
        });
    });
}

export function valueToPromise(value: any): Promise<any> {
    return value instanceof Promise ? value : Promise.resolve(value);
}

export function promiseTimeout(timeout: number = 1000): Promise<any> {
    return new Promise<any>((resolve) => {
        setTimeout(() => {
            resolve();
        }, timeout);
    });
}

export function getFunctionParams(func: Function): string[] {
    // Remove comments of the form /* ... */
    // Removing comments of the form //
    // Remove body of the function { ... }
    // removing "=>" if func is arrow function
    const str = func.toString()
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/(.)*/g, "")
        .replace(/{[\s\S]*}/, "")
        .replace(/=>/g, "")
        .trim();

    // Start parameter names after first "("
    const start = str.indexOf("(") + 1;

    // End parameter names is just before last ")"
    const end = str.length - 1;
    const result = str.substring(start, end).split(", ");
    const params = [];

    result.forEach(element => {

        // Removing any default value
        element = element.replace(/=[\s\S]*/g, "").trim();

        if (element.length > 0)
            params.push(element);
    });

    return params;
}

export function proxyFunction(name: string): Function {
    return function () {
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

export function ResolveEntity<T extends Document>(model: Model<T>, extraCheck?: (query: DocumentQuery<T, any>, action: Action) => T | Promise<T>): ParameterDecorator {
    const modelName = model.modelName;
    const paramName = modelName.toLowerCase();
    return createParamDecorator({
        required: false,
        value: async action => {
            const req = action.request as IRequest;
            const token = req.header(`x-${paramName}-token`);
            const id = req.params[`${paramName}Id`] as string;
            if (!id && !token) {
                throw new BadRequestError(`${modelName} id or token should be defined!`);
            }
            const query = !token
                ? model.findById(id)
                : model.findOne({token} as any);
            const doc = await query;
            if (!doc) {
                throw new HttpError(404, !token
                    ? `${modelName} could not be found with id: ${id}`
                    : `${modelName} could not be found with token: ${token}`);
            }
            if (isFunction(extraCheck)) {
                try {
                    action.request[paramName] = await valueToPromise(extraCheck(query, action)) || doc;
                    return action.request[paramName];
                } catch (e) {
                    throw new BadRequestError(`${modelName} check error: ${e.message || e}`);
                }
            }
            action.request[paramName] = doc;
            return doc;
        }
    });
}

export function getFileName(path: string, withExtension: boolean = false): string {
    const name = basename(path || "");
    return withExtension ? name : name.split(".").slice(0, -1).join(".");
}

export function getExtension(path: string): string {
    const name = basename(path || "");
    return name.split(".").pop();
}

export function idToString(value: any): any {
    if (Array.isArray(value)) {
        return value.map(idToString);
    }
    return value instanceof ObjectId ? value.toHexString() : null;
}

export function createTransformer(transform?: (doc: Document, ret: any, options?: any) => any) {
    return (doc: Document, ret: any, options?: any) => {
        ret.id = idToString(ret.id) || ret.id;
        if (doc._id) {
            ret._id = idToString(doc._id);
            ret.id = ret.id || ret._id;
        }
        delete ret._v;
        delete ret.__v;
        return isFunction(transform) ? transform(doc, ret, options) || ret : ret;
    };
}

export function broadcast(socketServer: Server, cb: (client: IClientSocket) => void): void {
    Array.from(Object.values(socketServer.sockets.sockets)).forEach(cb);
}

export function rand(min: number, max: number): number {
    return Math.round(random(min, max));
}

export function random(min: number, max: number): number {
    return min + Math.random() * (max - min);
}
