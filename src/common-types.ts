import {Application, Request} from "express";
import {Server} from "http";
import {RoutingControllersOptions} from "routing-controllers";
import {SocketControllersOptions} from "socket-controllers";
import {InjectionToken, Type} from "injection-js";

export interface IFixture {
    load(): Promise<any>;
}

export const FIXTURE = new InjectionToken<IFixture>("fixture-token");

export const EXPRESS = new InjectionToken<Application>("express");

export const HTTP_SERVER = new InjectionToken<Server>("http-server");

export const SOCKET_SERVER = new InjectionToken<SocketIO.Server>("socket-server");

export class Parameter {
    constructor(readonly name: string, readonly defaultValue: any, readonly resolver: (value) => any = null) {

    }
}

export interface IRequest extends Request {
    language?: string;
}

export interface IGalleryImage {
    folder: string;
    thumb: string;
    big: string;
}

export interface IGallerySize {
    width: number;
    height: number;
}

export interface ITranslations {
    [key: string]: any;
}

export interface IBackendConfig {
    params?: Parameter[],
    fixtures?: Type<IFixture>[],
    restOptions?: RoutingControllersOptions,
    socketOptions?: SocketControllersOptions
}
