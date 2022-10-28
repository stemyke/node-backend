import {join} from "path";
import {json} from "body-parser";
import {verify} from "jsonwebtoken";
import {container, DependencyContainer} from "tsyringe";
import {Action, HttpError, useContainer as useRoutingContainer, useExpressServer} from "routing-controllers";
import {useContainer as useSocketContainer, useSocketServer} from "socket-controllers";

import {
    DI_CONTAINER,
    EXPRESS,
    FIXTURE,
    HTTP_SERVER,
    IBackendConfig,
    IDependencyContainer,
    IPaginationParams,
    IRequest,
    IUser,
    JOB, OPENAPI_VALIDATION,
    Parameter,
    PARAMETER,
    Provider,
    SOCKET_SERVER,
    Type
} from "./common-types";

import {AssetProcessor} from "./services/asset-processor";
import {AssetResolver} from "./services/asset-resolver";
import {Assets} from "./services/assets";
import {BackendProvider} from "./services/backend-provider";
import {Cache} from "./services/cache";
import {CacheProcessor} from "./services/cache-processor";
import {Configuration} from "./services/configuration";
import {EndpointProvider} from "./services/endpoint-provider";
import {Fixtures} from "./services/fixtures";
import {Gallery} from "./services/gallery";
import {GalleryCache} from "./services/gallery-cache";
import {IdGenerator} from "./services/id-generator";
import {JobManager} from "./services/job-manager";
import {LazyAssets} from "./services/lazy-assets";
import {Logger} from "./services/logger";
import {MailSender} from "./services/mail-sender";
import {MemoryCache} from "./services/memory-cache";
import {MongoConnector} from "./services/mongo-connector";
import {OpenApi} from "./services/open-api";
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

import {DiContainer} from "./utilities/di-container";
import {EmptyJob} from "./utilities/empty-job";
import {diContainers, isFunction, isString, isType, valueToPromise} from "./utils";
import {setupStatic} from "./static";

export {
    FilterPredicate,
    isNullOrUndefined,
    isDefined,
    getType,
    isObject,
    isArray,
    isBoolean,
    isDate,
    isPrimitive,
    isString,
    isFunction,
    isConstructor,
    isType,
    isInterface,
    ucFirst,
    lcFirst,
    isObjectId,
    firstItem,
    lastItem,
    regroup,
    uniqueItems,
    getValue,
    groupBy,
    convertValue,
    toImage,
    bufferToStream,
    streamToBuffer,
    copyStream,
    mkdirRecursive,
    deleteFile,
    readFile,
    readAndDeleteFile,
    writeFile,
    valueToPromise,
    promiseTimeout,
    getConstructorName,
    getFunctionParams,
    getFileName,
    getExtension,
    createIdString,
    idToString,
    createTransformer,
    broadcast,
    rand,
    random,
    multiSubscription,
    observableFromFunction,
    padLeft,
    padRight,
    deleteFromBucket,
    filter,
    copy,
    assign,
    md5,
    runCommand,
    ConsoleColor,
    IJsonColors,
    colorize,
    jsonHighlight,
    replaceSpecialChars
} from "./utils";

export {IsFile, IsObjectId} from "./validators";

export {
    FIXTURE,
    JOB,
    EXPRESS,
    HTTP_SERVER,
    SOCKET_SERVER,
    PARAMETER,
    DI_CONTAINER,
    OPENAPI_VALIDATION,
    Type,
    FactoryProvider,
    IDependencyContainer,
    ClassBasedProvider,
    ValueBasedProvider,
    FactoryBasedProvider,
    TokenBasedProvider,
    SyringeProvider,
    Provider,
    Constructor,
    InferGeneric,
    PickMatching,
    OmitFirstArg,
    IMatchField,
    IProjectOptions,
    IUnwindOptions,
    IFixture,
    SchemaConverter,
    OpenApiValidation,
    ParamResolver,
    Parameter,
    SocketParam,
    SocketParams,
    ISocketMessage,
    IMessageBridge,
    IJob,
    IJobTask,
    JobParams,
    JobScheduleRange,
    JobScheduleTime,
    IProgress,
    IAssetCropInfo,
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
    IFileType,
    IBackendConfig
} from "./common-types";

export {AssetProcessor} from "./services/asset-processor";
export {AssetResolver} from "./services/asset-resolver";
export {Assets} from "./services/assets";
export {BackendProvider} from "./services/backend-provider";
export {Cache} from "./services/cache";
export {CacheProcessor} from "./services/cache-processor";
export {Configuration} from "./services/configuration";
export {EndpointProvider} from "./services/endpoint-provider";
export {Fixtures} from "./services/fixtures";
export {Gallery} from "./services/gallery";
export {GalleryCache} from "./services/gallery-cache";
export {IdGenerator} from "./services/id-generator";
export {JobManager} from "./services/job-manager";
export {LazyAssets} from "./services/lazy-assets";
export {MailSender} from "./services/mail-sender";
export {MemoryCache} from "./services/memory-cache";
export {MongoConnector} from "./services/mongo-connector";
export {OpenApi} from "./services/open-api";
export {Progresses} from "./services/progresses";
export {TemplateRenderer} from "./services/template-renderer";
export {TranslationProvider} from "./services/translation-provider";
export {Translator} from "./services/translator";
export {UserManager} from "./services/user-manager";

export {AssetImageParams} from "./requests/asset-image-params";

export {AuthController} from "./rest-controllers/auth.controller";
export {GalleryController} from "./rest-controllers/gallery.controller";

export {ErrorHandlerMiddleware} from "./rest-middlewares/error-handler.middleware";
export {LanguageMiddleware} from "./rest-middlewares/language.middleware";

export {BaseDoc, DocumentArray, PrimitiveArray} from "./utilities/base-doc";
export {IsDocumented} from "./utilities/decorators";
export {LazyAssetGenerator} from "./utilities/lazy-asset-generator";
export {
    ResolveEntity,
    paginateAggregations,
    hydratePopulated,
    unwindStage,
    projectStage,
    matchFieldStages,
    matchField,
    matchStage,
    letsLookupStage,
    lookupStages,
    paginate,
    injectServices,
    service
} from "./utilities/mongoose";

export async function resolveUser(req: IRequest): Promise<IUser> {
    if (req.user) return req.user;
    const container = req.container;
    const auth = req.header("Authorization") || "";
    let payload = null;
    try {
        const config = container.resolve(Configuration);
        payload = verify(auth.split(" ")[1], config.resolve("jwtSecret")) as any;
    } catch (e) {
        throw new HttpError(401, `Authentication failed. (${e.message})`);
    }
    if (!payload) {
        throw new HttpError(401, `Authentication failed. (Maybe invalid token)`);
    }
    req.user = await container.resolve(UserManager).getById(payload.id);
    return req.user;
}

export function createServices(): IDependencyContainer {
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
        new Parameter("mongoUri", ""),
        new Parameter("mongoDb", "node-backend"),
        new Parameter("mongoUser", null),
        new Parameter("mongoPassword", null),
        new Parameter("nodeEnv", "production"),
        new Parameter("appPort", 80),
        new Parameter("zmqPort", 3000),
        new Parameter("zmqBackPort", 3100),
        new Parameter("zmqRemoteHost", "tcp://127.0.0.1"),
        new Parameter("isWorker", false),
        new Parameter("mainEndpoint", ""),
        new Parameter("idChars", "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
        new Parameter("idSeparator", "-"),
        new Parameter("idPrefix", "ID-"),
        new Parameter("idParts", [4, 4]),
        new Parameter("jsonLimit", "250mb"),
        new Parameter("jobTimeout", 5 * 60 * 1000),
        new Parameter("cacheCollection", "cache"),
        new Parameter("logTags", []),
    ];

    // Convert parameters to providers
    const paramProviders = params.map(p => {
        return {
            provide: PARAMETER,
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
        CacheProcessor,
        Configuration,
        EndpointProvider,
        Fixtures,
        Gallery,
        GalleryCache,
        IdGenerator,
        JobManager,
        LazyAssets,
        Logger,
        MailSender,
        MemoryCache,
        MongoConnector,
        OpenApi,
        Progresses,
        TemplateRenderer,
        TranslationProvider,
        Translator,
        UserManager
    ] as Type<any>[];

    // Create container
    const diContainer = new DiContainer(container.createChildContainer());
    paramProviders.forEach(provider => {
        diContainer.register(provider.provide, provider);
    });
    services.forEach(service => {
        if (!container.isRegistered(service))
            diContainer.register(service, service);
    });
    return diContainer;
}

export async function setupBackend(config: IBackendConfig, providers?: Provider<any>[], parent?: IDependencyContainer): Promise<IDependencyContainer> {

    providers = Array.isArray(providers) ? providers : [];
    parent = parent || createServices();

    // Create fixtures
    const fixtureTypes = (config.fixtures || []);
    const fixtureProviders = fixtureTypes.map(fixture => {
        return {
            provide: FIXTURE,
            useClass: fixture
        };
    });

    // Create params
    const paramProviders = (config.params || []).map(p => {
        return {
            provide: PARAMETER,
            useValue: p
        }
    });

    // Create jobs
    const jobProviders = [EmptyJob].concat(config.jobs || []).map(jobType => {
        return {
            provide: JOB,
            useValue: jobType
        };
    });

    // Setup rest API
    const restOptions = config.restOptions || {};
    restOptions.defaultErrorHandler = false;
    restOptions.cors = Object.assign({
        credentials: true,
        exposedHeaders: ["content-disposition"],
        origin: (origin, callback) => {
            callback(null, true);
        }
    }, restOptions.cors || {});
    restOptions.routePrefix = config.routePrefix || "/api";
    restOptions.routePrefix = restOptions.routePrefix == "/" ? "" : restOptions.routePrefix;
    restOptions.middlewares = [ErrorHandlerMiddleware, ContainerMiddleware, LanguageMiddleware, RequestStartedMiddleware, RequestEndedMiddleware]
        .concat(restOptions.middlewares as any || []);
    restOptions.controllers = [AssetsController, AuthController, GalleryController, ProgressesController]
        .concat(restOptions.controllers as any || []);

    // Setup socket API
    const socketOptions = config.socketOptions || {};
    socketOptions.middlewares = [CompressionMiddleware].concat(socketOptions.middlewares as any || []);
    socketOptions.controllers = [ProgressController].concat(socketOptions.controllers as any || []);

    // Create providers

    const allProviders: Provider<any>[] = [];

    // Add multi tokens to sub container
    [PARAMETER].forEach(provide => {
        const values = parent.resolveAll(provide);
        values.forEach(useValue => {
            allProviders.push({provide, useValue});
        });
    });

    // Add other providers
    allProviders.push(
        ...fixtureTypes,
        ...fixtureProviders,
        ...paramProviders,
        ...jobProviders,
        ...restOptions.middlewares as Type<any>[],
        ...restOptions.controllers as Type<any>[],
        ...socketOptions.middlewares as Type<any>[],
        ...socketOptions.controllers as Type<any>[],
        ...providers,
        {
            provide: EXPRESS,
            useFactory: (container: DependencyContainer) => {
                return container.resolve(BackendProvider).express;
            }
        },
        {
            provide: HTTP_SERVER,
            useFactory: (container: DependencyContainer) => {
                return container.resolve(BackendProvider).server;
            }
        },
        {
            provide: SOCKET_SERVER,
            useFactory: (container: DependencyContainer) => {
                return container.resolve(BackendProvider).io;
            }
        }
    )

    // Create DI container

    const diContainer = parent.createChildContainer();

    allProviders.forEach(provider => {
        if (isType(provider)) {
            if (container.isRegistered(provider)) return;
            diContainer.register(provider, provider);
            return;
        }
        diContainer.register(provider.provide, provider as any);
    });

    diContainer.register(DI_CONTAINER, {
        useValue: diContainer
    });

    diContainer.register(OPENAPI_VALIDATION, {
        useValue: config.customValidation || (() => null)
    });

    diContainers.appContainer = diContainers.appContainer || diContainer;

    // Authentication
    restOptions.authorizationChecker = async (action: Action, roles: any[]) => {
        const user = await resolveUser(action.request);
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
        try {
            return await resolveUser(action.request);
        } catch (e) {
            return null;
        }
    };

    // Final setup
    const configuration = diContainer.resolve(Configuration);
    const bp = diContainer.resolve(BackendProvider);

    if (config.restOptions) {
        bp.express.use(json({
            limit: configuration.hasParam("jsonLimit")
                ? configuration.resolve("jsonLimit")
                : "250mb"
        }));
        useRoutingContainer(diContainer);
        useExpressServer(bp.express, restOptions);
        // Setup rest ai docs
        let openApi: OpenApi = null
        bp.express.get("/api-docs", (req, res) => {
            openApi = openApi || diContainer.get(OpenApi);
            res.header("Content-Type", "application/json")
                .status(200)
                .end(openApi.apiDocsStr);
        });
    }
    if (config.socketOptions) {
        useSocketContainer(diContainer);
        useSocketServer(bp.io, socketOptions);
    }

    // Connect to mongo if necessary
    if (configuration.hasParam("mongoUri") && configuration.resolve("mongoUri")) {
        console.log("Connecting to MongoDB...");
        const connector = diContainer.resolve(MongoConnector);
        await connector.connect();
        console.log("Successfully connected to MongoDB.");
    }

    await setupStatic(config.rootFolder, diContainer);

    return diContainer;
}
