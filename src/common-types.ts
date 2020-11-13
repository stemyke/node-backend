import {Application, Request} from "express";
import {Server} from "http";
import {Server as SocketServer, Socket} from "socket.io";
import {RoutingControllersOptions} from "routing-controllers";
import {SocketControllersOptions} from "socket-controllers";
import {InjectionToken, Injector, Type} from "injection-js";
import {SchemaObject} from "openapi3-ts";
import Buffer from "buffer";
import {Readable} from "stream";

export interface IFixture {
    load(): Promise<any>;
}

export type SchemaConverter = (
    meta: any,
    options: any
) => SchemaObject;

export const FIXTURE = new InjectionToken<IFixture>("fixture-token");

export const JOB = new InjectionToken<Type<IJob>>("fixture-token");

export const EXPRESS = new InjectionToken<Application>("express");

export const HTTP_SERVER = new InjectionToken<Server>("http-server");

export const SOCKET_SERVER = new InjectionToken<SocketServer>("socket-server");

export class Parameter {
    constructor(readonly name: string, readonly defaultValue: any, readonly resolver: (value) => any = null) {

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

export type JobParams = {[name: string]: string | number};

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

export interface IAssetConnection {
    write: (opts: any, stream: Readable, cb: Function) => void;
    unlink: (opts: any, cb: Function) => void;
    read: (opts: any) => Readable;
}

export interface IAssetMeta {
    filename?: string;
    classified?: boolean;
    downloadCount?: number;
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
    injector?: Injector;
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

export interface IBackendConfig {
    params?: Parameter[],
    fixtures?: Type<IFixture>[],
    jobs?: Type<IJob>[],
    restOptions?: RoutingControllersOptions,
    socketOptions?: SocketControllersOptions,
    customValidation?: SchemaConverter | SchemaObject
}
