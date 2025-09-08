import {mkdir, readFile as fsReadFile, unlink, writeFile as fsWriteFile} from "fs";
import {gzip, gunzip, ZlibOptions} from "zlib";
import {basename, dirname} from "path";
import {fileURLToPath} from "url";
import {exec as execChildProcess} from "child_process";
import {createHash} from "crypto";
import {from, Observable, Subject, Subscription} from "rxjs";
import {Server} from "socket.io";
import {GridFSBucket, ObjectId} from "mongodb";
import {Document} from "mongoose";
import mongoose from "mongoose";
import {PassThrough, Readable, ReadableOptions} from "stream";
import sharp_, {Region} from "sharp";
import {HttpError} from "routing-controllers";
import axios from "axios";
import {AnyWebByteStream} from "strtok3";
import {fileTypeFromStream as ftFromStream, fileTypeFromBuffer as ftFromBuffer} from "file-type/core";
import {
    IAssetCropInfo,
    IAssetImageParams,
    IAssetMeta,
    IClientSocket, IDependencyContainer,
    IFileType,
    ParamResolver,
    Type
} from "./common-types";

const sharp = sharp_;

export interface IDIContainers {
    appContainer: IDependencyContainer
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

export function isBuffer(value: any): value is Buffer {
    return value instanceof Buffer;
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

export function getFileName(path: string, withExtension: boolean = false): string {
    const name = basename(path || "");
    return withExtension ? name : name.split(".").slice(0, -1).join(".");
}

export function getExtension(path: string): string {
    const name = basename(path || "");
    return name.split(".").pop();
}

export function createIdString(): any {
    return new ObjectId().toHexString();
}

export function idToString(value: any): any {
    if (Array.isArray(value)) {
        return value.map(idToString);
    }
    return value instanceof ObjectId || value instanceof mongoose.Types.ObjectId
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
    socketServer.sockets.sockets.forEach((client: IClientSocket) => {
        cb(client);
    });
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
                subject.error(err);
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

export function camelCaseToDash(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

export function gzipPromised(data: string, opts?: ZlibOptions): Promise<string> {
    return new Promise((resolve, reject) => {
        gzip(data, opts, (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(result.toString("base64"));
        });
    });
}

export function gunzipPromised(data: string, opts?: ZlibOptions): Promise<string> {
    return new Promise((resolve, reject) => {
        gunzip(Buffer.from(data, "base64"), opts, (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(result.toString("utf8"));
        });
    });
}

export function deleteFromBucket(bucket: GridFSBucket, id: ObjectId | string): Promise<string> {
    const fileId = id instanceof ObjectId ? id : new ObjectId(id);
    return new Promise<string>(((resolve, reject) => {
        if (!id) {
            // We don't care about empty id
            resolve(null);
            return;
        }
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

function copyRecursive(target: any, source: any, predicate: FilterPredicate, copies: Map<any, any>): any {
    if (isPrimitive(source) || isDate(source) || isFunction(source)) return source;
    if (copies.has(source)) return copies.get(source);
    if (isArray(source)) {
        target = isArray(target) ? Array.from(target) : [];
        source.forEach((item, index) => {
            if (!predicate(item, index, target, source)) return;
            if (target.length > index)
                target[index] = copyRecursive(target[index], item, predicate, copies);
            else
                target.push(copyRecursive(null, item, predicate, copies));
        });
        copies.set(source, target);
        return target;
    }
    if (isBuffer(source)) return Buffer.from(source);

    // If object defines __shouldCopy as false, then don't copy it
    if (source.__shouldCopy === false) return source;
    // Copy object
    const shouldCopy = isFunction(source.__shouldCopy) ? source.__shouldCopy : () => true;
    if (isConstructor(source.constructor)) {
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
    // Set to copies to prevent circular references
    copies.set(source, target);

    // Copy map entries
    if (target instanceof Map) {
        if (source instanceof Map) {
            for (let [key, value] of source.entries()) {
                if (!predicate(value, key, target, source)) continue;
                target.set(key, !shouldCopy(key, value) ? value : copyRecursive(target.get(key), value, predicate, copies));
            }
        }
        return target;
    }

    // Copy object members
    let keys = Object.keys(source);
    keys.forEach(key => {
        if (!predicate(source[key], key, target, source)) return;
        target[key] = !shouldCopy(key, source[key]) ? source[key] : copyRecursive(target[key], source[key], predicate, copies);
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
    return copyRecursive(null, obj, predicate || defaultPredicate, new Map());
}

export function copy<T>(obj: T): T {
    return copyRecursive(null, obj, defaultPredicate, new Map());
}

export function assign<T>(target: T, source: any, predicate?: FilterPredicate): T {
    return copyRecursive(target, source, predicate, new Map());
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

export function regexEscape(str: string): string {
    return `${str}`.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function flatten(arr: any[]): any[] {
    return arr.reduce((flat, toFlatten) => {
        return flat.concat(isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
}

export function wrapError(e: any, message: string, httpCode: number = 500): Error {
    if (axios.isAxiosError(e)) {
        e.message = message;
        return e;
    }
    return new HttpError(httpCode, `${message}: ${e}`);
}

export function getDirName(): string {
    if (typeof __dirname === "undefined") {
        const __filename = fileURLToPath(import.meta.url);
        return dirname(__filename);
    }
    return __dirname;
}

export function prepareUrl(ending: string = "/"): ParamResolver {
    return url => {
        return url ? `${url.replace(/\/+$/, "")}${ending}` : ending;
    }
}

export const prepareUrlSlash = prepareUrl("/");

export const prepareUrlEmpty = prepareUrl("");

function checkTextFileType(type: IFileType): boolean {
    return type.mime.indexOf("text") >= 0 || type.mime.indexOf("xml") >= 0;
}

function fixTextFileType(type: IFileType, buffer: Buffer): IFileType {
    const text = buffer.toString("utf8");
    if (text.indexOf("<svg") >= 0) {
        return {ext: "svg", mime: "image/svg+xml"};
    }
    return type;
}

export async function fileTypeFromBuffer(buffer: Buffer): Promise<IFileType> {
    const stream = bufferToStream(buffer);
    const type = (await ftFromBuffer(buffer) ?? {ext: "txt", mime: "text/plain"}) as IFileType;
    if (checkTextFileType(type)) {
        return fixTextFileType(type, buffer);
    }
    return type;
}

export async function fileTypeFromStream(stream: AnyWebByteStream): Promise<IFileType> {
    return (await ftFromStream(stream) ?? {ext: "txt", mime: "text/plain"}) as IFileType;
}
