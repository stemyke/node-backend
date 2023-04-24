import {Server} from "http";
import {Request, Express} from "express";
import {Socket, Server as SocketServer} from "socket.io";
import {RoutingControllersOptions} from "routing-controllers";
import {SocketControllers, SocketControllersOptions} from "socket-controllers";
import {
    ClassProvider,
    DependencyContainer,
    InjectionToken,
    TokenProvider,
    ValueProvider,
    RegistrationOptions
} from "tsyringe";
import {SchemaObject} from "openapi3-ts";
import {Readable} from "stream";
import {Moment} from "moment";
import {AnyExpression, Expression} from "mongoose";
import {ICommandArgs, ISuggestion, ITerminal as ITerminalBase} from "@stemy/terminal-commands-addon";

// --- DI functions ---

export const Type = Function;

export interface Type<T = object> extends Function {
    new (...args: any[]): T;
}

export interface FactoryProvider<T> {
    useFactory: (dc: IDependencyContainer) => T;
}

export interface ITree {
    readonly path: string;
    resolveService(): any;
    resolveLeaves(): Map<string, ITree>;
    resolveServices(): Map<string, any>;
    resolveAncestor(path: string): ITree;
    resolvePath(path: string, throwError?: boolean): ITree;
}

export interface IDependencyContainer extends DependencyContainer {
    readonly parent: IDependencyContainer;
    readonly tree: ITree;
    readonly registeredTokens: ReadonlyArray<InjectionToken>;
    createChildContainer(): IDependencyContainer;
    register<T>(token: InjectionToken<T>, provider: ValueProvider<T>): IDependencyContainer;
    register<T>(token: InjectionToken<T>, provider: FactoryProvider<T>): IDependencyContainer;
    register<T>(token: InjectionToken<T>, provider: TokenProvider<T>, options?: RegistrationOptions): IDependencyContainer;
    register<T>(token: InjectionToken<T>, provider: ClassProvider<T>, options?: RegistrationOptions): IDependencyContainer;
    register<T>(token: InjectionToken<T>, provider: Type<T>, options?: RegistrationOptions): IDependencyContainer;
    registerSingleton<T>(from: InjectionToken<T>, to: InjectionToken<T>): IDependencyContainer;
    registerSingleton<T>(token: Type<T>): IDependencyContainer;
    registerType<T>(from: InjectionToken<T>, to: InjectionToken<T>): IDependencyContainer;
    registerInstance<T>(token: InjectionToken<T>, instance: T): IDependencyContainer;
    get<T>(token: InjectionToken<T>): T;
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

export type SyringeProvider<T> = Type<T> | ClassProvider<T> | ValueProvider<T> | FactoryProvider<T> | TokenProvider<T>;

export type Provider<T> = Type<T> | ClassBasedProvider<T> | ValueBasedProvider<T> | FactoryBasedProvider<T> | TokenBasedProvider<T>;

// --- Useful generic types ---

export type Constructor<T = object> = new (...args: any[]) => T

export type InferGeneric<T> = T extends Type<infer B> ? B : never;

export type PickMatching<T, V> = { [K in keyof T as T[K] extends V ? K : never]: T[K] }

export type OmitFirstArg<F> = F extends (x: any, ...args: infer P) => infer R ? (...args: P) => R : never;

// --- OpenApi ---

export type SchemaConverter = (meta: any, options: any) => SchemaObject;

export type OpenApiValidation = SchemaConverter | SchemaObject;

// --- Injection tokens ---

export const FIXTURE: InjectionToken<IFixture> = Symbol.for("fixture-token");

export const JOB: InjectionToken<IJob> = Symbol.for("job-token");

export const TERMINAL_COMMAND: InjectionToken<ITerminalCommand> = Symbol.for("terminal-command-token");

export const EXPRESS: InjectionToken<Express> = Symbol.for("express-token");

export const HTTP_SERVER: InjectionToken<Server> = Symbol.for("http-server-token");

export const SOCKET_SERVER: InjectionToken<SocketServer> = Symbol.for("socket-server-token");

export const SOCKET_CONTROLLERS: InjectionToken<SocketControllers> = Symbol.for("socket-controllers-token");

export const PARAMETER: InjectionToken<Parameter> = Symbol.for("parameter-token");

export const DI_CONTAINER: InjectionToken<IDependencyContainer> = Symbol.for("di-container-token");

export const OPENAPI_VALIDATION: InjectionToken<OpenApiValidation> = Symbol.for("openapi-validation-token");

// --- Mongo interfaces and types

export interface IMatchField {
    field: string;
    filter: any;
    when: boolean;
}

export interface IProjectOptions {
    [field: string]: AnyExpression | Expression | IProjectOptions;
}

export interface IUnwindOptions {
    path: string;
    includeArrayIndex?: string;
    preserveNullAndEmptyArrays?: boolean;
}

// --- Interfaces and utility classes ---

export interface IFixture {
    load(output?: IFixtureOutput): Promise<any>;
}

export interface IFixtureOutput {
    write(message: string): void;
    writeln(message: string): void;
}

export type ParamResolver = (value: string, helper?: (param: string) => any) => any;

export class Parameter {

    constructor(readonly name: string, public defaultValue: any, public resolver: ParamResolver = null) {

    }
}

export type SocketParam = string | number | boolean | SocketParams;

export type SocketParams = {
    [name: string]: SocketParam | Array<SocketParam>;
};

export type JobParams = SocketParams;

export interface ISocketMessage {
    message: string;
    params: SocketParams;
}

export interface IMessageBridge {
    sendMessage(message: string, params?: SocketParams): void;
}

// --- JOBS ---

export interface IJob {
    process(messaging?: IMessageBridge): Promise<any>;
}

export interface IJobTask {
    start: () => void;
    stop: () => void;
}

export interface JobScheduleRange {
    min: number;
    max: number;
}

export type JobScheduleTime = string | number | JobScheduleRange | Array<string | number>;

// --- COMMANDS & TERMINAL ---

export interface ITerminalFile extends ISuggestion {
    content?: string;
    buffer?: Buffer;
    accept?: string;
}

export interface ITerminal extends ITerminalBase {
    suggestFiles(accept: string): Promise<ITerminalFile[]>;
    downloadFile(filename: string, buffer: Buffer): Promise<void>;
}

export interface ITerminalCommand {
    name?: string;
    execute(args: ICommandArgs, terminal: ITerminal): Promise<any>;
    suggest?(args: ICommandArgs, terminal: ITerminal): Promise<Array<string | ISuggestion>>;
}

// --- ASSETS ---

export interface IProgress {
    id: string;
    current: number;
    max: number;
    message: string;
    error: string;
    canceled: boolean;
    percent: number;
    remaining: number;
    setMessageBridge(messageBridge: IMessageBridge): this;
    createSubProgress(progressValue: number, max?: number, message?: string): Promise<IProgress>;
    setMax(max: number): Promise<any>;
    setMessage(message: string): Promise<any>;
    setError(error: string): Promise<any>;
    advance(value?: number): Promise<any>;
    cancel(): Promise<any>;
    save(): Promise<any>;
    load(): Promise<this>;
    toJSON(): any;
}

export interface IAssetCropInfo {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface IAssetMeta {
    filename?: string;
    extension?: string;
    classified?: boolean;
    downloadCount?: number;
    firstDownload?: Date;
    lastDownload?: Date;
    crop?: IAssetCropInfo;
    cropBefore?: IAssetCropInfo;
    cropAfter?: IAssetCropInfo;
    canvasScaleX?: number;
    canvasScaleY?: number;
    [prop: string]: any;
}

export interface IAssetImageParams {
    rotation?: number;
    canvasScaleX?: number;
    canvasScaleY?: number;
    scaleX?: number;
    scaleY?: number;
    lazy?: boolean;
    crop?: string | boolean;
    cropBefore?: string | boolean | IAssetCropInfo;
    cropAfter?: string | boolean | IAssetCropInfo;
    [key: string]: any;
}

export interface IAsset {
    readonly id: string;
    readonly filename: string;
    readonly contentType: string;
    readonly metadata: IAssetMeta;
    readonly stream: Readable;
    unlink(): Promise<string>;
    getBuffer(): Promise<Buffer>;
    download(metadata?: IAssetMeta): Promise<Readable>;
    downloadImage(params?: IAssetImageParams, metadata?: IAssetMeta): Promise<Readable>;
    getImage(params?: IAssetImageParams): Promise<Readable>;
    save(): Promise<any>;
    load(): Promise<this>;
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
    save(): Promise<any>;
    load(): Promise<this>;
    toJSON(): any;
}

export interface IUser {
    _id?: string;
    id?: string;
    email?: string;
    password?: string;
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
    writeResult(isThumb: boolean, buffer: Buffer): Promise<void>;
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

export interface IFileType {
    ext: string;
    mime: string;
}

export type RoutingOptions = RoutingControllersOptions;

export type SocketOptions = Omit<SocketControllersOptions, "container">;

export interface IBackendConfig {
    rootFolder?: string;
    routePrefix?: string;
    params?: Parameter[];
    fixtures?: Type<IFixture>[];
    jobs?: Type<IJob>[];
    commands?: Type<ITerminalCommand>[];
    restOptions?: RoutingOptions;
    socketOptions?: SocketOptions;
    customValidation?: SchemaConverter | SchemaObject;
}
