import * as express_ from "express";
import {json} from "body-parser";
import {createServer} from "http";
import {verify} from "jsonwebtoken";
import {connect} from "mongoose";
import {Injector, Provider, ReflectiveInjector} from "injection-js";
import * as socket_io from "socket.io";
import {Action, HttpError, useContainer as useRoutingContainer, useExpressServer} from "routing-controllers";
import {useContainer as useSocketContainer, useSocketServer} from "socket-controllers";

import {getApiDocs} from "./rest-openapi";

import {EXPRESS, FIXTURE, HTTP_SERVER, SOCKET_SERVER, IBackendConfig, Parameter, IRequest, IUser} from "./common-types";

import {Assets} from "./services/assets";
import {Configuration} from "./services/configuration";
import {Fixtures} from "./services/fixtures";
import {Gallery} from "./services/gallery";
import {Logger} from "./services/logger";
import {MailSender} from "./services/mail-sender";
import {TemplateRenderer} from "./services/template-renderer";
import {TranslationProvider} from "./services/translation-provider";
import {Translator} from "./services/translator";
import {UserManager} from "./services/user-manager";

import {AssetsController} from "./rest-controllers/assets.controller";
import {AuthController} from "./rest-controllers/auth.controller";
import {GalleryController} from "./rest-controllers/gallery.controller";

import {ErrorHandlerMiddleware} from "./rest-middlewares/error-handler.middleware";
import {LanguageMiddleware} from "./rest-middlewares/language.middleware";

import {MessageController} from "./socket-controllers/message.controller";

import {CompressionMiddleware} from "./socket-middlewares/compression.middleware";

export {isNullOrUndefined, isDefined, getType, isString, isFunction, getValue, groupBy, convertValue, injectServices} from "./utils";

export {IFixture, SchemaConverter, FIXTURE, EXPRESS, HTTP_SERVER, SOCKET_SERVER, Parameter, IUser, IRequestBase, IRequest, IGalleryImage, IGallerySize, ITranslations, IBackendConfig} from "./common-types";

export {IAsset} from "./models/asset";

export {Assets} from "./services/assets";
export {BaseRepository} from "./services/base.repository";
export {Configuration} from "./services/configuration";
export {Fixtures} from "./services/fixtures";
export {Gallery} from "./services/gallery";
export {Logger} from "./services/logger";
export {MailSender} from "./services/mail-sender";
export {TemplateRenderer} from "./services/template-renderer";
export {TranslationProvider} from "./services/translation-provider";
export {Translator} from "./services/translator";
export {UserManager} from "./services/user-manager";

export {AuthController} from "./rest-controllers/auth.controller";
export {GalleryController} from "./rest-controllers/gallery.controller";

export {ErrorHandlerMiddleware} from "./rest-middlewares/error-handler.middleware";
export {LanguageMiddleware} from "./rest-middlewares/language.middleware";

const express = express_;
const socketIO = socket_io;

async function resolveUser(injector: Injector, req: IRequest): Promise<IUser> {
    if (req.user) return req.user;
    const auth = req.header("Authorization") || "";
    let payload = null;
    try {
        const config = injector.get(Configuration);
        payload = verify(auth.split(" ")[1], config.resolve("jwtSecret")) as any;
    } catch (e) {
        throw new HttpError(401, `Authentication failed. (${e.message})`);
    }
    if (!payload) {
        throw new HttpError(401, `Authentication failed. (Maybe invalid token)`);
    }
    return injector.get(UserManager).getById(payload.id);
}

export async function setupBackend(config: IBackendConfig, ...providers: Provider[]): Promise<Injector> {
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
    restOptions.controllers = [AssetsController, AuthController, GalleryController].concat(restOptions.controllers as any || []);

    // Setup socket API
    const socketOptions = config.socketOptions || {};
    socketOptions.middlewares = [CompressionMiddleware].concat(socketOptions.middlewares as any || []);
    socketOptions.controllers = [MessageController].concat(socketOptions.controllers as any || []);

    // Create injector
    const services = [
        Assets,
        Configuration,
        Fixtures,
        Gallery,
        Logger,
        MailSender,
        TemplateRenderer,
        TranslationProvider,
        Translator,
        UserManager
    ];

    const injector = ReflectiveInjector.resolveAndCreate([
        ...fixtureTypes,
        ...fixtureProviders,
        ...services,
        ...providers,
        ...restOptions.middlewares as Provider[],
        ...restOptions.controllers as Provider[],
        ...socketOptions.middlewares as Provider[],
        ...socketOptions.controllers as Provider[],
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
        },
    ]) as Injector;

    // Authentication
    restOptions.authorizationChecker = async (action: Action, roles: any[]) => {
        const user = await resolveUser(injector, action.request);
        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        if (Array.isArray(roles) && roles.length > 0) {
            const hasRole = roles.some(role => userRoles.indexOf(role) >= 0);
            if (!hasRole) {
                throw new HttpError(401, "Authentication failed. (User doesn't have access to this resource)");
            }
        }
        return true;
    };
    restOptions.currentUserChecker = async (action: Action) => {
        return resolveUser(injector, action.request);
    };

    // Add parameters
    const configuration = injector.get(Configuration);
    configuration.add(new Parameter("defaultLanguage", "en"));
    configuration.add(new Parameter("smtpHost", "smtp.sendgrid.net"));
    configuration.add(new Parameter("smtpPort", 587));
    configuration.add(new Parameter("smtpUser", "apikey"));
    configuration.add(new Parameter("smtpPassword", ""));
    configuration.add(new Parameter("mailSenderAddress", "info@stemy.hu"));
    configuration.add(new Parameter("translationsTemplate", "https://translation.service/[lang]"));
    configuration.add(new Parameter("jwtSecret", "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9"));
    configuration.add(new Parameter("jwtSecret", "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9"));
    configuration.add(new Parameter("mongoDb", "node-backend"));
    configuration.add(new Parameter("mongoUser", null));
    configuration.add(new Parameter("mongoPassword", null));

    (config.params || []).forEach(param => {
        configuration.add(param);
    });

    // Final setup
    useRoutingContainer(injector);
    useSocketContainer(injector);

    useExpressServer(app, restOptions);
    useSocketServer(io, socketOptions);

    // Setup rest ai docs
    app.get("/api-docs", (req, res) => {
        res.status(200).end(getApiDocs(config.customValidation));
    });

    // Connect to mongo if necessary
    if (configuration.hasParam("mongoUri")) {
        await connect(configuration.resolve("mongoUri"), {
            dbName: configuration.resolve("mongoDb"),
            user: configuration.resolve("mongoUser"),
            pass: configuration.resolve("mongoPassword"),
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
    }

    // Load fixtures
    const fixtures = injector.get(Fixtures);
    await fixtures.load();

    return injector;
}
