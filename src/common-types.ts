import {Application, Request} from "express";
import {Server} from "http";
import {Server as SocketServer} from "socket.io";
import {RoutingControllersOptions} from "routing-controllers";
import {SocketControllersOptions} from "socket-controllers";
import {InjectionToken, Injector, Type} from "injection-js";
import {SchemaObject} from "openapi3-ts";
import Buffer from "buffer";

export interface IFixture {
    load(): Promise<any>;
}

export type SchemaConverter = (
    meta: any,
    options: any
) => SchemaObject;

export const FIXTURE = new InjectionToken<IFixture>("fixture-token");

export const EXPRESS = new InjectionToken<Application>("express");

export const HTTP_SERVER = new InjectionToken<Server>("http-server");

export const SOCKET_SERVER = new InjectionToken<SocketServer>("socket-server");

export class Parameter {
    constructor(readonly name: string, readonly defaultValue: any, readonly resolver: (value) => any = null) {

    }
}

export interface IUser {
    _id?: string;
    id?: string;
    email: string;
    password: string;
    roles: string[];
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

export interface IPaginationBase<T> {
    count: number
    items: T[];
}

export interface IPagination extends IPaginationBase<any> {

}

export interface IBackendConfig {
    params?: Parameter[],
    fixtures?: Type<IFixture>[],
    restOptions?: RoutingControllersOptions,
    socketOptions?: SocketControllersOptions,
    customValidation?: SchemaConverter | SchemaObject
}
