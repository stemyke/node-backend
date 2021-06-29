import {Request} from "express";
import {Socket} from "socket.io";
import {RoutingControllersOptions} from "routing-controllers";
import {SocketControllersOptions} from "socket-controllers";
import {
    ClassProvider,
    DependencyContainer,
    FactoryProvider,
    InjectionToken,
    TokenProvider,
    ValueProvider
} from "tsyringe";
import {SchemaObject} from "openapi3-ts";
import Buffer from "buffer";
import {Readable} from "stream";
import {Moment} from "moment";

// --- Injection tokens ---

export const FIXTURE: InjectionToken = Symbol.for("fixture-token");

export const JOB: InjectionToken = Symbol.for("job-token");

export const EXPRESS: InjectionToken = Symbol.for("express-token");

export const HTTP_SERVER: InjectionToken = Symbol.for("http-server-token");

export const SOCKET_SERVER: InjectionToken = Symbol.for("socket-server-token");

export const PARAMETER: InjectionToken = Symbol.for("parameter-token");

export const DI_CONTAINER: InjectionToken = Symbol.for("di-container-token");

// --- DI functions ---
export const Type = Function;

export interface Type<T = object> extends Function {
    new (...args: any[]): T;
}

export interface ClassBasedProvider<T> extends ClassProvider<T> {
    provide: InjectionToken;
}

export interface ValueBasedProvider<T> extends ValueProvider<T> {
    provide: InjectionToken;
}

export interface FactoryBasedProvider<T> extends FactoryProvider<T> {
    provide: InjectionToken;
}

export interface TokenBasedProvider<T> extends TokenProvider<T> {
    provide: InjectionToken;
}

export type InjectionProvider<T> = ClassBasedProvider<T> | ValueBasedProvider<T> | FactoryBasedProvider<T> | TokenBasedProvider<T>;

export type Provider<T> = Type<T> | InjectionProvider<T>;

export class DiWrapper {
    constructor(private container: DependencyContainer) {
    }

    get(token: InjectionToken): any {
        return this.container.resolve(token);
    }
}

// --- Interfaces and utility classes ---

export interface IFixture {
    load(): Promise<any>;
}

export type SchemaConverter = (
    meta: any,
    options: any
) => SchemaObject;

export type ParamResolver = (value: string) => any;

export class Parameter {

    constructor(readonly name: string, public defaultValue: any, public resolver: ParamResolver = null) {

    }
}

export interface IJob {
    process(): Promise<any>;
}

export interface IJobTask {
    start: () => this;
    stop: () => this;
    destroy: () => void;
    getStatus: () => string;
}

export type JobParams = {[name: string]: string | number | boolean};

export interface JobScheduleRange {
    min: number;
    max: number;
}

export type JobScheduleTime = string | number | JobScheduleRange | Array<string | number>;

export interface IProgress {
    id?: string;
    message?: any;
    error?: any;
    percent?: number;
    current: number;
    remaining: number;
    createSubProgress(progressValue: number, max?: number, message?: string): Promise<IProgress>;
    setMax(max: number): Promise<any>;
    setError(error: string): Promise<any>;
    advance(value?: number): Promise<any>;
    save(): Promise<any>;
    toJSON(): any;
}

export interface IAssetMeta {
    filename?: string;
    classified?: boolean;
    downloadCount?: number;
    firstDownload?: Date;
    lastDownload?: Date;
    [prop: string]: any;
}

export interface IAssetImageParams {
    rotation?: number;
    canvasScaleX?: number;
    canvasScaleY?: number;
    scaleX?: number;
    scaleY?: number;
    lazy?: boolean;
}

export interface IAsset {
    id?: string;
    filename?: string;
    contentType?: string;
    metadata?: IAssetMeta;
    stream: Readable,
    unlink(): Promise<string>;
    getBuffer(): Promise<Buffer>;
    download(metadata?: IAssetMeta): Promise<Readable>;
    downloadImage(params?: IAssetImageParams, metadata?: IAssetMeta): Promise<Readable>;
    getImage(params?: IAssetImageParams): Promise<Readable>;
    toJSON(): any;
}

export interface ILazyAsset {
    id: string;
    jobName: string;
    jobParams: any;
    jobQue: string;
    progressId?: string;
    assetId?: string;
    unlink(): Promise<string>;
    startWorking(): void;
    loadAsset(): Promise<IAsset>;
    writeAsset(asset: IAsset): Promise<IAsset>;
    toJSON(): any;
}

export interface IUser {
    _id?: string;
    id?: string;
    email: string;
    password: string;
    roles: string[];
}

export interface IClientSocket extends Socket {
    interestedProgresses: Set<string>;
}

export interface IRequestBase<T> extends Request {
    id?: string;
    started?: Moment;
    ended?: Moment;
    container?: DependencyContainer;
    language?: string;
    user?: T;
}

export interface IRequest extends IRequestBase<IUser> {

}

export interface IGalleryImage {
    folder: string;
    thumb: string;
    big: string;
    serve(id: string): Promise<Buffer>
}

export interface IGallerySize {
    width?: number;
    height?: number;
}

export interface IGalleryImageHandler {
    getOriginal(): Promise<Buffer>;
    writeResult(isThumb: boolean, buffer: Buffer): Promise<any>;
    hasResult(isThumb: boolean): Promise<boolean>;
    serveResult(isThumb: boolean): Promise<Buffer>;
}

export interface ITranslations {
    [key: string]: any;
}

export interface IPaginationMeta {
    total: number;
    [key: string]: any;
}

export interface IPaginationBase<T> {
    count: number
    items: T[];
    meta?: IPaginationMeta;
}

export interface IPagination extends IPaginationBase<any> {

}

export interface IPaginationParams {
    page: number;
    limit: number;
    sort?: string;
    populate?: string[];
    [key: string]: any;
}

export type FontFormat = "opentype" | "truetype" | "woff" | "woff2" | "datafork";

export interface IBackendConfig {
    routePrefix?: string;
    params?: Parameter[];
    fixtures?: Type<IFixture>[];
    jobs?: Type<IJob>[];
    restOptions?: RoutingControllersOptions;
    socketOptions?: SocketControllersOptions;
    customValidation?: SchemaConverter | SchemaObject;
}
