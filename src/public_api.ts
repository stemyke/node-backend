import {join} from "path";
import {json} from "body-parser";
import {verify} from "jsonwebtoken";
import {Injector, Provider, ReflectiveInjector} from "injection-js";
import {Action, HttpError, useContainer as useRoutingContainer, useExpressServer} from "routing-controllers";
import {useContainer as useSocketContainer, useSocketServer} from "socket-controllers";

import {getApiDocs} from "./rest-openapi";

import {
    EXPRESS,
    FIXTURE,
    HTTP_SERVER,
    IBackendConfig,
    IPaginationParams,
    IRequest,
    IUser,
    JOB,
    PARAMETER,
    Parameter,
    SOCKET_SERVER
} from "./common-types";

import {AssetProcessor} from "./services/asset-processor";
import {AssetResolver} from "./services/asset-resolver";
import {Assets} from "./services/assets";
import {BackendProvider} from "./services/backend-provider";
import {Cache} from "./services/cache";
import {Configuration} from "./services/configuration";
import {Fixtures} from "./services/fixtures";
import {Gallery} from "./services/gallery";
import {GalleryCache} from "./services/gallery-cache";
import {IdGenerator} from "./services/id-generator";
import {JobManager} from "./services/job-manager";
import {LazyAssetHelper} from "./services/lazy-asset-helper";
import {LazyAssets} from "./services/lazy-assets";
import {Logger} from "./services/logger";
import {MailSender} from "./services/mail-sender";
import {MongoConnector} from "./services/mongo-connector";
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
import {ContainerMiddleware} from "./rest-middlewares/container.middleware";
import {LanguageMiddleware} from "./rest-middlewares/language.middleware";
import {RequestEndedMiddleware} from "./rest-middlewares/request-ended.middleware";
import {RequestStartedMiddleware} from "./rest-middlewares/request-started.middleware";

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
    lcFirst,
    getValue,
    groupBy,
    convertValue,
    injectServices,
    paginate,
    lookupPipelines,
    hydratePopulated,
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
    getConstructorName,
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
    multiSubscription,
    observableFromFunction,
    padLeft,
    padRight,
    deleteFromBucket
} from "./utils";

export {IsFile, IsObjectId} from "./validators";

export {
    FIXTURE,
    JOB,
    EXPRESS,
    HTTP_SERVER,
    SOCKET_SERVER,
    PARAMETER,
    IFixture,
    SchemaConverter,
    ParamResolver,
    Parameter,
    IJob,
    IJobTask,
    JobParams,
    JobScheduleRange,
    JobScheduleTime,
    IProgress,
    IAssetMeta,
    IAssetImageParams,
    IAsset,
    ILazyAsset,
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
    IPaginationParams,
    FontFormat,
    IBackendConfig
} from "./common-types";

export {AssetProcessor} from "./services/asset-processor";
export {AssetResolver} from "./services/asset-resolver";
export {Assets} from "./services/assets";
export {BackendProvider} from "./services/backend-provider";
export {Cache} from "./services/cache";
export {Configuration} from "./services/configuration";
export {Fixtures} from "./services/fixtures";
export {Gallery} from "./services/gallery";
export {GalleryCache} from "./services/gallery-cache";
export {IdGenerator} from "./services/id-generator";
export {JobManager} from "./services/job-manager";
export {LazyAssets} from "./services/lazy-assets";
export {Logger} from "./services/logger";
export {MailSender} from "./services/mail-sender";
export {MongoConnector} from "./services/mongo-connector";
export {Progresses} from "./services/progresses";
export {TemplateRenderer} from "./services/template-renderer";
export {TranslationProvider} from "./services/translation-provider";
export {Translator} from "./services/translator";
export {UserManager} from "./services/user-manager";

export {AuthController} from "./rest-controllers/auth.controller";
export {GalleryController} from "./rest-controllers/gallery.controller";

export {ErrorHandlerMiddleware} from "./rest-middlewares/error-handler.middleware";
export {LanguageMiddleware} from "./rest-middlewares/language.middleware";

export {LazyAssetGenerator} from "./utilities/lazy-asset-generator";

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

export function createServices(): ReflectiveInjector {
    // List of parameters
    const params = [
        new Parameter("templatesDir", join(__dirname, "templates")),
        new Parameter("galleryDir", join(__dirname, "gallery")),
        new Parameter("cacheDir", join(__dirname, "cache")),
        new Parameter("defaultLanguage", "en"),
        new Parameter("smtpHost", "smtp.sendgrid.net"),
        new Parameter("smtpPort", 587),
        new Parameter("smtpUser", "apikey"),
        new Parameter("smtpPassword", ""),
        new Parameter("mailSenderAddress", "info@stemy.hu"),
        new Parameter("translationsTemplate", "https://translation.service/[lang]"),
        new Parameter("jwtSecret", "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9"),
        new Parameter("mongoDb", "node-backend"),
        new Parameter("mongoUser", null),
        new Parameter("mongoPassword", null),
        new Parameter("nodeEnv", "development"),
        new Parameter("appPort", 80),
        new Parameter("redisHost", "127.0.0.1"),
        new Parameter("redisPort", 6379),
        new Parameter("redisPassword", "123456"),
        new Parameter("redisNamespace", "resque"),
        new Parameter("redisCluster", "mymaster"),
        new Parameter("redisSentinels", null, value => {
            if (!value) return null;
            return value.split(", ").map(item => {
                const values = item.split(":");
                return {host: values[0], port: Number(values[1])};
            });
        }),
        new Parameter("workQueues", ["main"]),
        new Parameter("isWorker", false),
        new Parameter("mainEndpoint", ""),
        new Parameter("idChars", "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
        new Parameter("idSeparator", "-"),
        new Parameter("idPrefix", "ID-"),
        new Parameter("idParts", [4, 4]),
        new Parameter("jsonLimit", "250mb"),
    ];

    // Convert parameters to providers
    const paramProviders = params.map(p => {
        return {
            provide: PARAMETER,
            multi: true,
            useValue: p
        }
    });

    // List of services
    const services = [
        AssetProcessor,
        AssetResolver,
        Assets,
        BackendProvider,
        Cache,
        Configuration,
        Gallery,
        GalleryCache,
        Logger,
        IdGenerator,
        JobManager,
        LazyAssetHelper,
        LazyAssets,
        MailSender,
        MongoConnector,
        ProgressHelper,
        Progresses,
        TemplateRenderer,
        TranslationProvider,
        Translator,
        UserManager
    ];

    // Create injector
    return ReflectiveInjector.resolveAndCreate([
        ...paramProviders,
        ...services
    ]);
}

export async function setupBackend(config: IBackendConfig, providers?: Provider[], parent?: ReflectiveInjector): Promise<ReflectiveInjector> {

    providers = Array.isArray(providers) ? providers : [];
    parent = parent || createServices();

    // Create fixtures
    const fixtureTypes = (config.fixtures || []);
    const fixtureProviders = fixtureTypes.map(fixture => {
        return {
            provide: FIXTURE,
            multi: true,
            useExisting: fixture
        };
    });

    // Create params
    const paramProviders = (config.params || []).map(p => {
        return {
            provide: PARAMETER,
            multi: true,
            useValue: p
        }
    });

    // Create jobs
    const jobProviders = (config.jobs || []).map(jobType => {
        return {
            provide: JOB,
            multi: true,
            useValue: jobType
        };
    });

    // Setup rest API
    const restOptions = config.restOptions || {};
    restOptions.defaultErrorHandler = false;
    restOptions.cors = {
        credentials: true,
        origin: (origin, callback) => {
            callback(null, true);
        }
    };
    restOptions.routePrefix = config.routePrefix || "/api";
    restOptions.middlewares = [ErrorHandlerMiddleware, ContainerMiddleware, LanguageMiddleware, RequestStartedMiddleware, RequestEndedMiddleware]
        .concat(restOptions.middlewares as any || []);
    restOptions.controllers = [AssetsController, AuthController, GalleryController, ProgressesController]
        .concat(restOptions.controllers as any || []);

    // Setup socket API
    const socketOptions = config.socketOptions || {};
    socketOptions.middlewares = [CompressionMiddleware].concat(socketOptions.middlewares as any || []);
    socketOptions.controllers = [ProgressController].concat(socketOptions.controllers as any || []);

    const subServices = [
        {
            provide: Configuration,
            deps: [PARAMETER],
            useFactory: (params) => {
                return new Configuration(params)
            }
        },
        Fixtures
    ];

    const injector = parent.resolveAndCreateChild([
        ...subServices,
        ...fixtureTypes,
        ...fixtureProviders,
        ...paramProviders,
        ...jobProviders,
        ...restOptions.middlewares as Provider[],
        ...restOptions.controllers as Provider[],
        ...socketOptions.middlewares as Provider[],
        ...socketOptions.controllers as Provider[],
        ...providers,
        {
            provide: EXPRESS,
            deps: [BackendProvider],
            useFactory: (bp: BackendProvider) => {
                return bp.express;
            }
        },
        {
            provide: HTTP_SERVER,
            deps: [BackendProvider],
            useFactory: (bp: BackendProvider) => {
                return bp.server;
            }
        },
        {
            provide: SOCKET_SERVER,
            deps: [BackendProvider],
            useFactory: (bp: BackendProvider) => {
                return bp.io;
            }
        },
    ]);

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

    // Final setup
    const configuration = injector.get(Configuration);
    const bp = injector.get(BackendProvider);

    if (config.restOptions) {
        bp.express.use(json({
            limit: configuration.hasParam("jsonLimit")
                ? configuration.resolve("jsonLimit")
                : "250mb"
        }));
        useRoutingContainer(injector);
        useExpressServer(bp.express, restOptions);
        // Setup rest ai docs
        bp.express.get("/api-docs", (req, res) => {
            res.status(200).end(getApiDocs(config.customValidation));
        });
    }
    if (config.socketOptions) {
        useSocketContainer(injector);
        useSocketServer(bp.io, socketOptions);
    }

    // Connect to mongo if necessary
    if (configuration.hasParam("mongoUri")) {
        const connector = injector.get(MongoConnector);
        await connector.connect();
    }

    // Load fixtures
    // if (!configuration.resolve("isWorker")) {
    //     const fixtures = injector.get(Fixtures);
    //     await fixtures.load();
    // }

    return injector;
}
