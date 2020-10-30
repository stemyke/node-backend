import express_ from "express";
import {join} from "path";
import {json} from "body-parser";
import {createServer} from "http";
import {verify} from "jsonwebtoken";
import {connect} from "mongoose";
import cacheman_mongo from "cacheman-mongodb";
import {Injector, Provider, ReflectiveInjector} from "injection-js";
import socket_io from "socket.io";
import {Action, HttpError, useContainer as useRoutingContainer, useExpressServer} from "routing-controllers";
import {useContainer as useSocketContainer, useSocketServer} from "socket-controllers";

import {getApiDocs} from "./rest-openapi";

import {EXPRESS, FIXTURE, JOB, HTTP_SERVER, IBackendConfig, IRequest, IUser, Parameter, SOCKET_SERVER} from "./common-types";

import {Assets} from "./services/assets";
import {Cache} from "./services/cache";
import {Configuration} from "./services/configuration";
import {Fixtures} from "./services/fixtures";
import {Gallery} from "./services/gallery";
import {GalleryCache} from "./services/gallery-cache";
import {IdGenerator} from "./services/id-generator";
import {JobManager} from "./services/job-manager";
import {Logger} from "./services/logger";
import {MailSender} from "./services/mail-sender";
import {ProgressHelper} from "./services/progress-helper";
import {Progresses} from "./services/progresses";
import {TemplateRenderer} from "./services/template-renderer";
import {TranslationProvider} from "./services/translation-provider";
import {Translator} from "./services/translator";
import {UserManager} from "./services/user-manager";

import {AssetsController} from "./rest-controllers/assets.controller";
import {AuthController} from "./rest-controllers/auth.controller";
import {GalleryController} from "./rest-controllers/gallery.controller";
import {ProgressesController} from "./rest-controllers/progresses.controller";

import {ErrorHandlerMiddleware} from "./rest-middlewares/error-handler.middleware";
import {InjectorMiddleware} from "./rest-middlewares/injector.middleware";
import {LanguageMiddleware} from "./rest-middlewares/language.middleware";

import {ProgressController} from "./socket-controllers/progress.controller";

import {CompressionMiddleware} from "./socket-middlewares/compression.middleware";
import {isFunction, isString, valueToPromise} from "./utils";

export {
    isNullOrUndefined,
    isDefined,
    getType,
    isObject,
    isArray,
    isString,
    isFunction,
    ucFirst,
    getValue,
    groupBy,
    convertValue,
    injectServices,
    paginate,
    paginateAggregations,
    bufferToStream,
    streamToBuffer,
    mkdirRecursive,
    deleteFile,
    readFile,
    readAndDeleteFile,
    writeFile,
    valueToPromise,
    promiseTimeout,
    getFunctionParams,
    proxyFunction,
    proxyFunctions,
    ResolveEntity,
    getFileName,
    getExtension,
    idToString,
    createTransformer,
    broadcast,
    rand,
    random,
} from "./utils";

export {IsFile} from "./validators";

export {
    IFixture,
    SchemaConverter,
    FIXTURE,
    JOB,
    EXPRESS,
    HTTP_SERVER,
    SOCKET_SERVER,
    Parameter,
    IJob,
    IJobTask,
    JobScheduleRange,
    JobScheduleTime,
    JobParams,
    IUser,
    IClientSocket,
    IRequestBase,
    IRequest,
    IGalleryImage,
    IGallerySize,
    IGalleryImageHandler,
    ITranslations,
    IPaginationMeta,
    IPaginationBase,
    IPagination,
    IBackendConfig
} from "./common-types";

export {IAsset, IAssetImageParams} from "./models/asset";

export {Assets} from "./services/assets";
export {Cache} from "./services/cache";
export {Configuration} from "./services/configuration";
export {Fixtures} from "./services/fixtures";
export {Gallery} from "./services/gallery";
export {GalleryCache} from "./services/gallery-cache";
export {IdGenerator} from "./services/id-generator";
export {JobManager} from "./services/job-manager";
export {Logger} from "./services/logger";
export {MailSender} from "./services/mail-sender";
export {Progresses} from "./services/progresses";
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
const CachemanMongo = cacheman_mongo;

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
    req.user = await injector.get(UserManager).getById(payload.id);
    return req.user;
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

    const jobProviders = (config.jobs || []).map(jobType => {
        return {
            provide: JOB,
            multi: true,
            useValue: jobType
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
    restOptions.middlewares = [ErrorHandlerMiddleware, InjectorMiddleware, LanguageMiddleware].concat(restOptions.middlewares as any || []);
    restOptions.controllers = [AssetsController, AuthController, GalleryController, ProgressesController].concat(restOptions.controllers as any || []);

    // Setup socket API
    const socketOptions = config.socketOptions || {};
    socketOptions.middlewares = [CompressionMiddleware].concat(socketOptions.middlewares as any || []);
    socketOptions.controllers = [ProgressController].concat(socketOptions.controllers as any || []);

    // Create injector
    const services = [
        Assets,
        Cache,
        Configuration,
        Fixtures,
        Gallery,
        GalleryCache,
        Logger,
        IdGenerator,
        JobManager,
        MailSender,
        ProgressHelper,
        Progresses,
        TemplateRenderer,
        TranslationProvider,
        Translator,
        UserManager
    ];

    const injector = ReflectiveInjector.resolveAndCreate([
        ...fixtureTypes,
        ...fixtureProviders,
        ...jobProviders,
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

    Injector["appInjector"] = injector;

    // Authentication
    restOptions.authorizationChecker = async (action: Action, roles: any[]) => {
        const user = await resolveUser(injector, action.request);
        if (!user) {
            throw new HttpError(401, "Authentication failed. (User can't be found.)");
        }
        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        if (Array.isArray(roles) && roles.length > 0) {
            let lastError = null;
            for (let role of roles) {
                if (isFunction(role)) {
                    try {
                        if (await valueToPromise(role(user, action))) {
                            return true;
                        }
                    } catch (e) {
                        lastError = e;
                    }
                }
                if (userRoles.indexOf(role) >= 0) return true;
            }
            const error = !lastError || (!lastError.message && !isString(lastError))
                ? "User doesn't have access to this resource"
                : lastError.message || lastError;
            throw new HttpError(401, `Authentication failed. (${error})`);
        }
        return true;
    };
    restOptions.currentUserChecker = async (action: Action) => {
        return resolveUser(injector, action.request);
    };

    // Add parameters
    const configuration = injector.get(Configuration);
    configuration.add(new Parameter("templatesDir", join(__dirname, "templates")));
    configuration.add(new Parameter("galleryDir", join(__dirname, "gallery")));
    configuration.add(new Parameter("cacheDir", join(__dirname, "cache")));
    configuration.add(new Parameter("defaultLanguage", "en"));
    configuration.add(new Parameter("smtpHost", "smtp.sendgrid.net"));
    configuration.add(new Parameter("smtpPort", 587));
    configuration.add(new Parameter("smtpUser", "apikey"));
    configuration.add(new Parameter("smtpPassword", ""));
    configuration.add(new Parameter("mailSenderAddress", "info@stemy.hu"));
    configuration.add(new Parameter("translationsTemplate", "https://translation.service/[lang]"));
    configuration.add(new Parameter("jwtSecret", "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9"));
    configuration.add(new Parameter("mongoDb", "node-backend"));
    configuration.add(new Parameter("mongoUser", null));
    configuration.add(new Parameter("mongoPassword", null));
    configuration.add(new Parameter("nodeEnv", "development"));
    configuration.add(new Parameter("appPort", 80));
    configuration.add(new Parameter("redisHost", "127.0.0.1"));
    configuration.add(new Parameter("redisPort", 6379));
    configuration.add(new Parameter("redisPassword", "123456"));
    configuration.add(new Parameter("redisNamespace", "resque"));
    configuration.add(new Parameter("workQueues", ["main"]));
    configuration.add(new Parameter("isWorker", false));
    configuration.add(new Parameter("mainEndpoint", ""));
    configuration.add(new Parameter("idChars", "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"));
    configuration.add(new Parameter("idSeparator", "-"));
    configuration.add(new Parameter("idPrefix", "ID-"));
    configuration.add(new Parameter("idParts", [4, 4]));

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
        const db = (await connect(configuration.resolve("mongoUri"), {
            dbName: configuration.resolve("mongoDb"),
            user: configuration.resolve("mongoUser"),
            pass: configuration.resolve("mongoPassword"),
            useNewUrlParser: true,
            useUnifiedTopology: true
        })).connection.db;
        CachemanMongo["appInstance"] = new CachemanMongo(db, {compression: true, collection: "cache"});
    }

    // Load fixtures
    if (!configuration.resolve("isWorker")) {
        const fixtures = injector.get(Fixtures);
        await fixtures.load();
    }

    return injector;
}
