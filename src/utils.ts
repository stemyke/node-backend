import {DocumentType, ReturnModelType} from "@typegoose/typegoose";
import {exec as execChildProcess} from "child_process";
import {createHash} from "crypto";
import {DependencyContainer, InjectionToken} from "tsyringe";
import {from, Observable, Subject, Subscription} from "rxjs";
import {canReportError} from "rxjs/internal/util/canReportError";
import {Server} from "socket.io";
import {mkdir, readFile as fsReadFile, unlink, writeFile as fsWriteFile} from "fs";
import {basename, dirname} from "path";
import {GridFSBucket, ObjectId} from "mongodb";
import {Document, Expression, FilterQuery, Model, model, PipelineStage, Query, Schema, Types} from "mongoose";
import {getValue as getMongoValue, setValue as setMongoValue} from "mongoose/lib/utils";
import {PassThrough, Readable, ReadableOptions} from "stream";
import sharp_, {Region} from "sharp";
import {Action, BadRequestError, createParamDecorator, HttpError} from "routing-controllers";
import {
    IAssetCropInfo,
    IAssetImageParams,
    IAssetMeta,
    IClientSocket,
    IMatchField,
    InferGeneric,
    IPaginationBase,
    IPaginationParams,
    IProjectOptions,
    IRequest,
    IUnwindOptions,
    Type
} from "./common-types";

const sharp = sharp_;

export interface IDIContainers {
    appContainer: DependencyContainer
}

export const diContainers: IDIContainers = {
    appContainer: null
};

export type FilterPredicate = (value: any, key?: any, target?: any, source?: any) => boolean;

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

export function isBoolean(value: any): value is boolean {
    return typeof value === "boolean";
}

export function isDate(value: any): value is Date {
    return !!value && value[Symbol.toPrimitive] && !isNaN(value) && "undefined" !== typeof value.getDate;
}

export function isPrimitive(value: any): boolean {
    const type = typeof value;
    return value == null || (type !== "object" && type !== "function");
}

export function isString(value: any): value is string {
    return typeof value === "string";
}

export function isFunction(value: any): value is Function {
    return typeof value === "function";
}

export function isConstructor(value: any): boolean {
    return (value && typeof value === "function" && value.prototype && value.prototype.constructor) === value && value.name !== "Object";
}

export function isType(value: any): value is Type<any> {
    return isConstructor(value);
}

export function isInterface(obj: any, interFaceObject: { [key: string]: string }): boolean {
    if (!obj || typeof obj !== "object" || isArray(obj) || !isObject(interFaceObject)) return false;
    const keys = Object.keys(interFaceObject);
    for (const key of keys) {
        let type = interFaceObject[key] || "";
        if (type.startsWith("*")) {
            type = type.substr(1);
            if (obj.hasOwnProperty(key) && getType(obj[key]) !== type) return false;
        } else if (!obj.hasOwnProperty(key) || getType(obj[key]) !== type) {
            return false;
        }
    }
    return true;
}

export function ucFirst(value: string): string {
    if (!value) return "";
    return value[0].toUpperCase() + value.substr(1);
}

export function lcFirst(value: string): string {
    if (!value) return "";
    return value[0].toLowerCase() + value.substr(1);
}

export function isObjectId(id: string): boolean {
    return typeof id === "string" && id.length == 24 && !isNaN(Number("0x" + id));
}

export function firstItem<T>(value: T[]): T {
    return value[0];
}

export function lastItem<T>(value: T[]): T {
    return value[value.length - 1];
}

export function regroup<T>(value: T[], comparator: (a: T, b: T) => boolean): Array<T[]> {
    const result: Array<T[]> = [];
    if (!isArray(value) || value.length == 0) return result;
    value = Array.from(value);
    result.push([value.shift()]);
    value.forEach(item => {
        const group = result.find(g => g.some(a => comparator(a, item)));
        if (group) {
            group.push(item);
            return;
        }
        result.push([item]);
    });
    return result;
}

export function uniqueItems<T>(value: T[]): T[] {
    return value.filter((v, ix) => value.indexOf(v) === ix);
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
            try {
                return JSON.parse(value);
            } catch (e) {
                return `${value}`.split(", ");
            }
    }
    return value;
}

export function injectServices(schema: Schema<any>, services: { [prop: string]: InjectionToken<any> }) {
    const serviceMap: { [prop: string]: any } = {};
    Object.keys(services).forEach(prop => {
        schema
            .virtual(prop)
            .get(() => {
                const diContainer = diContainers.appContainer;
                serviceMap[prop] = serviceMap[prop] || (!diContainer ? {} : diContainer.resolve(services[prop]));
                return serviceMap[prop];
            });
    });
}

export function paginate<T extends Type<any>, U = InferGeneric<T>>(model: ReturnModelType<T>, where: FilterQuery<DocumentType<U>>, params: IPaginationParams): Promise<IPaginationBase<DocumentType<U>>> {
    return model.countDocuments(where).then(count => {
        let query: Query<any, any> = model.find(where);
        if (isString(params.sort)) {
            query = query.sort(params.sort);
        }
        if (isArray(params.populate)) {
            params.populate.forEach(field => {
                query = query.populate(field);
            });
        }
        return (params.limit > 0 ? query.skip(params.page * params.limit).limit(params.limit) : query).then(items => {
            const meta = {total: count};
            return {count, items, meta};
        });
    });
}

export function lookupStages(from: string, localField: string, as: string = null, foreignField: string = "_id", shouldUnwind: boolean = true): [PipelineStage.Lookup, PipelineStage.Unwind] {
    as = as || localField.replace("Id", "");
    const stages: [PipelineStage.Lookup, PipelineStage.Unwind] = [
        {
            $lookup: {
                from,
                localField,
                foreignField,
                as
            }
        },
        {
            $unwind: {
                path: `$${as}`,
                preserveNullAndEmptyArrays: true
            }
        }
    ];
    if (!shouldUnwind) {
        stages.splice(1, 1);
    }
    return stages;
}

export function letsLookupStage(from: string, pipeline: Exclude<PipelineStage, PipelineStage.Merge | PipelineStage.Out | PipelineStage.Search>[], as: string = null, letFields: any = null): PipelineStage.Lookup {
    as = as || from;
    letFields = letFields || {id: "$_id"};
    return {
        $lookup: {
            from,
            let: letFields,
            pipeline,
            as
        }
    };
}

export function matchStage(match: FilterQuery<any>): PipelineStage.Match {
    return {$match: match};
}

export function matchField(field: string, filter: any, when: boolean): IMatchField {
    return {field, filter, when};
}

export function matchFieldStages(...fields: IMatchField[]): ReadonlyArray<PipelineStage.Match> {
    const match = {};
    fields.forEach(field => {
        if (field.when) {
            match[field.field] = field.filter;
        }
    });
    return Object.keys(match).length > 0 ? [matchStage(match)] : [];
}

export function projectStage(fields: IProjectOptions): PipelineStage.Project {
    return {$project: fields};
}

export function unwindStage(fieldOrOpts: string | IUnwindOptions): PipelineStage.Unwind {
    return {$unwind: fieldOrOpts};
}

export function hydratePopulated<T extends Document>(modelType: Model<T>, json: any): T {
    let object = modelType.hydrate(json);

    for (const [path, obj] of Object.entries(modelType.schema.obj)) {
        let {ref, type} = obj as any;
        if (Array.isArray(type) && type.length > 0) {
            ref = type[0].ref;
        }
        if (!ref) continue;
        const value = getMongoValue(path, json);
        const hydrateVal = val => {
            if (val == null || val instanceof Types.ObjectId) return val;
            return hydratePopulated(model(ref) as any, val);
        };
        if (Array.isArray(value)) {
            setMongoValue(path, value.map(hydrateVal), object);
            continue;
        }
        setMongoValue(path, hydrateVal(value), object);
    }

    return object;

}

export async function paginateAggregations<T extends Type<any>, U = InferGeneric<T>>(model: ReturnModelType<T>, aggregations: PipelineStage[], params: IPaginationParams, metaProjection: any = {}): Promise<IPaginationBase<DocumentType<U>>> {
    const sortField = !isString(params.sort) || !params.sort ? null : (params.sort.startsWith("-") ? params.sort.substr(1) : params.sort);
    const sortAggregation: PipelineStage.Sort[] = !sortField ? [] : [{
        $sort: {[sortField]: sortField == params.sort ? 1 : -1}
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
                items: params.limit > 0 ? {$slice: ["$result", params.page * params.limit, params.limit]} : "$result",
                count: {$size: "$result"},
                meta: {
                    total: {$size: "$result"},
                    ...metaProjection
                }
            }
        }
    ]);
    const pagination = result[0] as IPaginationBase<DocumentType<U>>;
    if (!pagination) {
        return {items: [], count: 0, meta: {total: 0}};
    }
    pagination.items = pagination.items.map(i => hydratePopulated(model, i) as any);
    return pagination;
}

const cropInterface = {
    x: "number",
    y: "number",
    w: "number",
    h: "number"
};

function toCropRegion(cropInfo: string | boolean | IAssetCropInfo): Region {
    let crop = cropInfo as IAssetCropInfo;
    if (isString(cropInfo)) {
        try {
            crop = JSON.parse(cropInfo as string);
        } catch (e) {
            return null;
        }
    }
    if (!isInterface(crop, cropInterface)) return null;
    return {
        width: Math.round(crop.w),
        height: Math.round(crop.h),
        top: Math.round(crop.y),
        left: Math.round(crop.x)
    };
}

export async function toImage<T = Buffer | Readable>(src: T, params?: IAssetImageParams, meta?: IAssetMeta): Promise<T> {

    // Default params and meta
    params = params || {};
    meta = meta || {};

    // Get default crop info
    const crop = toCropRegion(meta.crop);

    // Return the src if there are no params and no default crop exists
    if (meta.extension === "svg" || (Object.keys(params).length == 0 && !crop)) {
        return src;
    }

    // Parse params
    params.rotation = isNaN(params.rotation) ? 0 : Math.round(params.rotation / 90) * 90;
    params.canvasScaleX = isNaN(params.canvasScaleX) ? 1 : Number(params.canvasScaleX);
    params.canvasScaleY = isNaN(params.canvasScaleY) ? 1 : Number(params.canvasScaleY);
    params.scaleX = isNaN(params.scaleX) ? 1 : Number(params.scaleX);
    params.scaleY = isNaN(params.scaleY) ? 1 : Number(params.scaleY);
    params.crop = isBoolean(params.crop) ? params.crop : params.crop == "true";

    let buffer = src instanceof Readable ? await streamToBuffer(src) : src as any;
    try {
        // Get crop info
        const cropBefore = toCropRegion(params.cropBefore || (params.crop ? meta.cropBefore : null));
        const cropAfter = toCropRegion(params.cropAfter || (params.crop ? meta.cropAfter : null));
        // Get metadata
        let img = sharp(buffer);
        let {width, height} = await img.metadata();
        // Crop before resize
        if (cropBefore) {
            width = cropBefore.width;
            height = cropBefore.height;
            img = img.extract(cropBefore);
        } else if (crop) {
            width = crop.width;
            height = crop.height;
            img = img.extract(crop);
        }
        // Resize canvas
        const canvasScaleX = meta?.canvasScaleX || 1;
        const canvasScaleY = meta?.canvasScaleY || 1;
        if (params.canvasScaleX !== canvasScaleX || params.canvasScaleY !== canvasScaleY) {
            width = Math.round(width * params.canvasScaleX);
            height = Math.round(height * params.canvasScaleY);
            img = img.resize({width, height, background: "#00000000", fit: "contain"});
        }
        // Resize image
        if (params.scaleX !== 1 || params.scaleY !== 1) {
            width = Math.round(width * params.scaleX);
            height = Math.round(height * params.scaleY);
            img = img.resize({width, height, background: "#00000000", fit: "fill"});
        }
        // Crop after resize
        if (cropAfter) {
            img = img.extract(cropAfter);
        }
        // Rotate
        if (params.rotation !== 0) {
            buffer = await img.toBuffer();
            img = sharp(buffer).rotate(params.rotation);
        }
        buffer = await img.toBuffer();
        src = src instanceof Readable ? bufferToStream(buffer) : buffer;
        return src;
    } catch (e) {
        console.log("Image conversion error", e);
        src = src instanceof Readable ? bufferToStream(buffer) : buffer;
        return src;
    }
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

class ReadableStreamClone extends Readable {

    constructor(readableStream: Readable, opts?: ReadableOptions) {
        super(opts);
        readableStream?.on("data", chunk => {
            this.push(chunk);
        });
        readableStream?.on("end", () => {
            this.push(null);
        });
        readableStream?.on("error", err => {
            this.emit("error", err);
        });
    }

    _read(size: number) {

    }
}

export function copyStream(stream: Readable, opts?: ReadableOptions): Readable {
    return new ReadableStreamClone(stream, opts);
}

export function mkdirRecursive(path: string, mode: number = null): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        mkdir(path, {mode: mode || 0o777, recursive: true}, err => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

export function deleteFile(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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

export function promiseTimeout(timeout: number = 1000, error: boolean = false): Promise<string> {
    return new Promise<any>((resolve, reject) => {
        setTimeout(() => {
            if (error) {
                reject(`Timeout exceeded: ${timeout}ms`);
                return;
            }
            resolve(`Timeout: ${timeout}ms`);
        }, timeout);
    });
}

export function getConstructorName(type: Type<any>): string {
    return type.prototype.constructor.name;
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

export function ResolveEntity<T extends Type<any>, U = InferGeneric<T>>(model: ReturnModelType<T>, extraCheck?: (query: Query<DocumentType<U>, any>, action: Action) => Promise<DocumentType<U>>): ParameterDecorator {
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
            let doc: Document = null;
            if (isFunction(extraCheck)) {
                try {
                    doc = await valueToPromise(extraCheck(query, action));
                } catch (e) {
                    throw new BadRequestError(`${modelName} check error: ${e.message || e}`);
                }
            } else {
                doc = await query;
            }
            if (!doc) {
                throw new HttpError(404, !token
                    ? `${modelName} could not be found with id: ${id}`
                    : `${modelName} could not be found with token: ${token}`);
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
    return value instanceof ObjectId || value instanceof Types.ObjectId
        ? value.toHexString()
        : (isString(value) ? value : value || null);
}

export function createTransformer(transform?: (doc: Document, ret: any, options?: any) => any) {
    return (doc: Document, ret: any, options?: any) => {
        ret.id = idToString(ret.id) || ret.id;
        if (doc._id) {
            ret._id = idToString(doc._id);
            ret.id = ret.id || ret._id;
        }
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

export function multiSubscription(...subscriptions: Subscription[]): Subscription {
    return new Subscription(() => {
        subscriptions.forEach(s => {
            s.unsubscribe();
        });
    });
}

export function observableFromFunction(callbackFunc: () => any): Observable<any> {
    let subject: any;
    return new Observable<any>((subscriber) => {
        if (!subject) {
            subject = new Subject();
            try {
                subject = from(callbackFunc());
            } catch (err) {
                if (canReportError(subject)) {
                    subject.error(err);
                } else {
                    console.warn(err);
                }
            }
        }
        return subject.subscribe(subscriber);
    });
}

export function padLeft(value: any, count: number = 3, padWith: string = "0"): string {
    return `${value}`.padStart(count, padWith);
}

export function padRight(value: any, count: number = 3, padWith: string = "0"): string {
    return `${value}`.padEnd(count, padWith);
}

export function deleteFromBucket(bucket: GridFSBucket, fileId: ObjectId): Promise<string> {
    return new Promise<string>(((resolve, reject) => {
        bucket.delete(fileId, error => {
            let err = error as any;
            if (error) {
                err = error.message || error || "";
                if (!isString(err) || !err.startsWith("FileNotFound")) {
                    reject(err);
                    return;
                }
            }
            resolve(fileId.toHexString());
        });
    }));
}

const defaultPredicate: FilterPredicate = () => true;

function copyRecursive(target: any, source: any, predicate?: FilterPredicate): any {
    predicate = predicate || defaultPredicate;
    if (isPrimitive(source) || isDate(source) || isFunction(source)) return source;
    if (isArray(source)) {
        target = isArray(target) ? Array.from(target) : [];
        source.forEach((item, index) => {
            if (!predicate(item, index, target, source)) return;
            if (target.length > index)
                target[index] = copyRecursive(target[index], item, predicate);
            else
                target.push(copyRecursive(null, item, predicate));
        });
        return target;
    }
    const shouldCopy = isFunction(source.__shouldCopy) ? source.__shouldCopy : () => true;
    if (isConstructor(source.constructor)) {
        if (source.__shouldCopy === false) return source;
        if (!target) {
            try {
                target = new source.constructor();
            } catch (e) {
                const proto = source.constructor.prototype || source.prototype;
                target = Object.create(proto);
            }
        }
    } else {
        target = Object.assign({}, target || {});
    }
    // Copy map entries
    if (target instanceof Map) {
        if (source instanceof Map) {
            for (let [key, value] of source.entries()) {
                if (!predicate(value, key, target, source)) continue;
                target.set(key, !shouldCopy(key, value) ? value : copyRecursive(target.get(key), value, predicate));
            }
        }
        return target;
    }

    // Copy object members
    let keys = Object.keys(source);
    target = keys.reduce((result, key) => {
        if (!predicate(source[key], key, result, source)) return result;
        result[key] = !shouldCopy(key, source[key]) ? source[key] : copyRecursive(result[key], source[key], predicate);
        return result;
    }, target);

    // Copy object properties
    const descriptors = Object.getOwnPropertyDescriptors(source);
    keys = Object.keys(descriptors).filter(k => keys.indexOf(k) < 0);
    keys.forEach(key => {
        Object.defineProperty(target, key, descriptors[key]);
    });
    return target;
}

export function filter<T>(obj: T, predicate: FilterPredicate): Partial<T> {
    return copyRecursive(null, obj, predicate);
}

export function copy<T>(obj: T): T {
    return copyRecursive(null, obj);
}

export function assign<T>(target: T, source: any, predicate?: FilterPredicate): T {
    return copyRecursive(target, source, predicate);
}

export function md5(data: any): string {
    if (isObject(data)) {
        data = JSON.stringify(data);
    }
    if (!isString(data)) {
        throw `Can't md5 other that raw object or string`;
    }
    return createHash("md5").update(data).digest("hex");
}

export function runCommand(scriptPath: string, expectedCode: number = 0): Promise<string> {
    return new Promise((resolve, reject) => {
        const cp = execChildProcess(scriptPath, (error, stdout) => {
            if (error && expectedCode !== error.code) {
                console.log(error);
                reject(error);
                return;
            }
            const lines = (stdout || "").split("\n");
            let line = null;
            while (!line && lines.length > 0) {
                line = lines.pop();
            }
            resolve(line);
        });
        cp.stdout.on("data", function (data) {
            console.log(data.toString());
        });
        cp.stderr.on("data", function (data) {
            console.error(data.toString());
        });
    });
}

export enum ConsoleColor {
    Reset = "\x1b[0m",
    Bright = "\x1b[1m",
    Dim = "\x1b[2m",
    Underscore = "\x1b[4m",
    Blink = "\x1b[5m",
    Reverse = "\x1b[7m",
    Hidden = "\x1b[8m",

    FgBlack = "\x1b[30m",
    FgRed = "\x1b[31m",
    FgGreen = "\x1b[32m",
    FgYellow = "\x1b[33m",
    FgBlue = "\x1b[34m",
    FgMagenta = "\x1b[35m",
    FgCyan = "\x1b[36m",
    FgWhite = "\x1b[37m",
    FgDefault = "\x1b[38m",

    BgBlack = "\x1b[40m",
    BgRed = "\x1b[41m",
    BgGreen = "\x1b[42m",
    BgYellow = "\x1b[43m",
    BgBlue = "\x1b[44m",
    BgMagenta = "\x1b[45m",
    BgCyan = "\x1b[46m",
    BgWhite = "\x1b[47m",
    BgDefault = "\x1b[48m"
}

export interface IJsonColors {
    keyColor?: ConsoleColor;
    numberColor?: ConsoleColor;
    stringColor?: ConsoleColor;
    trueColor?: ConsoleColor;
    falseColor?: ConsoleColor;
    nullColor?: ConsoleColor;
}

const defaultColors: IJsonColors = {
    keyColor: ConsoleColor.FgWhite,
    numberColor: ConsoleColor.FgBlue,
    stringColor: ConsoleColor.FgYellow,
    trueColor: ConsoleColor.FgGreen,
    falseColor: ConsoleColor.FgRed,
    nullColor: ConsoleColor.BgMagenta
}

export function colorize(input: any, color: ConsoleColor): string {
    return `${color}${input}${ConsoleColor.Reset}`;
}

export function jsonHighlight(input: string | object, colorOptions?: IJsonColors): string {
    const colors = Object.assign({}, defaultColors, colorOptions)
    const json = (isString(input) ? input : JSON.stringify(input, null, 2)).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+]?\d+)?)/g, (match) => {
        let color = colors.numberColor
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                color = colors.keyColor
            } else {
                color = colors.stringColor;
                match = '"' + match.substr(1, match.length - 2) + '"';
            }
        } else {
            color = /true/.test(match)
                ? colors.trueColor
                : /false/.test(match)
                    ? colors.falseColor
                    : /null/.test(match)
                        ? colors.nullColor
                        : color
        }
        return `${color}${match}${ConsoleColor.Reset}`
    })
}

export function replaceSpecialChars(str: string, to: string = "-"): string {
    return `${str}`.replace(/[&\/\\#, +()$~%.@'":*?<>{}]/g, to);
}
