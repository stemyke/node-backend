import * as express_ from "express";
import {json} from "body-parser";
import {createServer} from "http";
import {Injector, Provider, ReflectiveInjector} from "injection-js";
import * as socket_io from "socket.io";
import {useContainer as useRoutingContainer, useExpressServer} from "routing-controllers";
import {useContainer as useSocketContainer, useSocketServer} from "socket-controllers";

import {getApiDocs} from "./rest-openapi";

import {EXPRESS, FIXTURE, HTTP_SERVER, SOCKET_SERVER, IBackendConfig, Parameter} from "./common-types";

import {Configuration} from "./services/configuration";
import {Fixtures} from "./services/fixtures";
import {Gallery} from "./services/gallery";
import {Logger} from "./services/logger";
import {MailSender} from "./services/mail-sender";
import {TemplateRenderer} from "./services/template-renderer";
import {TranslationProvider} from "./services/translation-provider";
import {Translator} from "./services/translator";

import {GalleryController} from "./rest-controllers/gallery.controller";

import {ErrorHandlerMiddleware} from "./rest-middlewares/error-handler.middleware";
import {LanguageMiddleware} from "./rest-middlewares/language.middleware";

import {MessageController} from "./socket-controllers/message.controller";

import {CompressionMiddleware} from "./socket-middlewares/compression.middleware";

export {isNullOrUndefined, isDefined, getType, isString, isFunction, getValue, groupBy, convertValue} from "./utils";

export {IFixture, SchemaConverter, FIXTURE, EXPRESS, HTTP_SERVER, SOCKET_SERVER, Parameter, IRequest, IGalleryImage, IGallerySize, ITranslations, IBackendConfig} from "./common-types";

export {Configuration} from "./services/configuration";
export {Fixtures} from "./services/fixtures";
export {Gallery} from "./services/gallery";
export {Logger} from "./services/logger";
export {MailSender} from "./services/mail-sender";
export {TemplateRenderer} from "./services/template-renderer";
export {TranslationProvider} from "./services/translation-provider";
export {Translator} from "./services/translator";

export {GalleryController} from "./rest-controllers/gallery.controller";

export {ErrorHandlerMiddleware} from "./rest-middlewares/error-handler.middleware";
export {LanguageMiddleware} from "./rest-middlewares/language.middleware";

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

const express = express_;
const socketIO = socket_io;

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
    const io = socketIO(server, {path: "/socket"});

    // Setup rest API
    app.use(json());

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
    socketOptions.middlewares = [CompressionMiddleware].concat(socketOptions.middlewares as any || []);
    socketOptions.controllers = [MessageController].concat(socketOptions.controllers as any || []);

    // Create final injector
    injector = ReflectiveInjector.resolveAndCreate([
        ...restOptions.middlewares as Provider[],
        ...restOptions.controllers as Provider[],
        ...socketOptions.middlewares as Provider[],
        ...socketOptions.controllers as Provider[],
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
    configuration.add(new Parameter("defaultLanguage", "en"));
    configuration.add(new Parameter("smtpHost", "smtp.sendgrid.net"));
    configuration.add(new Parameter("smtpPort", 587));
    configuration.add(new Parameter("smtpUser", "apikey"));
    configuration.add(new Parameter("smtpPassword", ""));
    configuration.add(new Parameter("mailSenderAddress", "info@stemy.hu"));
    configuration.add(new Parameter("translationsTemplate", "https://translation.service/[lang]"));

    (config.params || []).forEach(param => {
        configuration.add(param);
    });

    // Load fixtures
    const fixtures = injector.get(Fixtures);
    await fixtures.load();

    // Final setup
    useRoutingContainer(injector);
    useSocketContainer(injector);

    useExpressServer(app, restOptions);
    useSocketServer(io, socketOptions);

    // Setup rest ai docs
    app.get("/api-docs", (req, res) => {
        res.status(200).end(getApiDocs(config.customValidation));
    });

    return injector;
}
