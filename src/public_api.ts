import * as express from "express";
import {createServer, Server} from "http";
import {Injector, Provider, ReflectiveInjector} from "injection-js";
import * as socketIO from "socket.io";
import {useContainer as useRoutingContainer, useExpressServer} from "routing-controllers";
import {useContainer as useSocketContainer, useSocketServer} from "socket-controllers";

import {FIXTURE, EXPRESS, HTTP_SERVER, SOCKET_SERVER, IBackendConfig} from "./common-types";

import {Configuration} from "./services/configuration";
import {Fixtures} from "./services/fixtures";
import {Gallery} from "./services/gallery";
import {Logger} from "./services/logger";
import {MailSender} from "./services/mail-sender";
import {TemplateRenderer} from "./services/template-renderer";
import {TranslationProvider} from "./services/translation-provider";
import {Translator} from "./services/translator";

import {GalleryController} from "./controllers/gallery.controller";

import {ErrorHandlerMiddleware} from "./middlewares/error-handler.middleware";
import {LanguageMiddleware} from "./middlewares/language.middleware";

export {Configuration} from "./services/configuration";
export {Fixtures} from "./services/fixtures";
export {Gallery} from "./services/gallery";
export {Logger} from "./services/logger";
export {MailSender} from "./services/mail-sender";
export {TemplateRenderer} from "./services/template-renderer";
export {TranslationProvider} from "./services/translation-provider";
export {Translator} from "./services/translator";

export {GalleryController} from "./controllers/gallery.controller";

export {ErrorHandlerMiddleware} from "./middlewares/error-handler.middleware";
export {LanguageMiddleware} from "./middlewares/language.middleware";

export function createServices(): Injector {
    return ReflectiveInjector.resolveAndCreate([
        Configuration,
        Fixtures,
        Gallery,
        Logger,
        MailSender,
        TemplateRenderer,
        TranslationProvider,
        Translator
    ]);
}

export async function setupBackend(injector: Injector, config: IBackendConfig): Promise<Injector> {
    const fixtureTypes = (config.fixtures || []);
    const fixtureProviders = fixtureTypes.map(fixture => {
        return {
            provide: FIXTURE,
            multi: true,
            useExisting: fixture
        };
    });
    const app = express();
    const server = createServer(app);
    const io = socketIO(server);

    // Setup rest API
    const restOptions = config.restOptions || {};
    restOptions.defaultErrorHandler = false;
    restOptions.cors = {
        credentials: true,
        origin: (origin, callback) => {
            callback(null, true);
        }
    };
    restOptions.routePrefix = "/api";
    restOptions.middlewares = [ErrorHandlerMiddleware, LanguageMiddleware].concat(restOptions.middlewares as any || []);
    restOptions.controllers = [GalleryController].concat(restOptions.controllers as any || []);

    // Setup socket API
    const socketOptions = config.socketOptions || {};

    // Create final injector
    injector = ReflectiveInjector.resolveAndCreate([
        ...restOptions.middlewares as Provider[],
        ...restOptions.controllers as Provider[],
        ...fixtureTypes,
        ...fixtureProviders,
        {
            provide: EXPRESS,
            useValue: app
        },
        {
            provide: HTTP_SERVER,
            useValue: server
        },
        {
            provide: SOCKET_SERVER,
            useValue: io
        }
    ], injector);

    // Add parameters
    const configuration = injector.get(Configuration);
    (config.params || []).forEach(param => {
        configuration.add(param);
    });

    // Load fixtures
    const fixtures = injector.get(Fixtures);
    await fixtures.load();

    // Final setup
    useRoutingContainer(injector);
    useExpressServer(app, restOptions);
    useSocketContainer(injector);
    useSocketServer(io, socketOptions);

    return injector;
}
