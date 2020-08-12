import {Request} from "express";
import {RoutingControllersOptions} from "routing-controllers";
import {SocketControllersOptions} from "socket-controllers";

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
    restOptions: RoutingControllersOptions,
    socketOptions: SocketControllersOptions
}
