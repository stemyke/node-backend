import {
    ClassProvider,
    DependencyContainer,
    Frequency,
    InjectionToken,
    isFactoryProvider,
    RegistrationOptions,
    TokenProvider,
    ValueProvider
} from "tsyringe";
import {FactoryProvider, IDependencyContainer, ITree, Type} from "../common-types";
import {Tree} from "./tree";
import {isString} from "../utils";

interface PreResolutionInterceptorCallback<T = any> {
    (token: InjectionToken<T>, resolutionType: "Single" | "All"): void;
}

interface PostResolutionInterceptorCallback<T = any> {
    (token: InjectionToken<T>, result: T | T[], resolutionType: "Single" | "All"): void;
}

export class DiContainer implements IDependencyContainer {

    get registeredTokens(): ReadonlyArray<InjectionToken> {
        return (this.parent?.registeredTokens || []).concat(this.tokens);
    }

    get tree(): ITree {
        return this.myTree;
    }

    protected tokens: Array<InjectionToken>;
    protected tokenSet: Set<InjectionToken>;
    protected myTree: Tree;

    constructor(protected container: DependencyContainer, readonly parent: IDependencyContainer = null) {
        container["wrapperContainer"] = this;
        this.tokens = [];
        this.tokenSet = new Set<InjectionToken>();
        this.myTree = new Tree(this, "");
    }

    beforeResolution<T>(token: InjectionToken<T>, callback: PreResolutionInterceptorCallback<T>, options?: { frequency: Frequency }): void {
        this.container.beforeResolution(token, callback, options);
    }

    afterResolution<T>(token: InjectionToken<T>, callback: PostResolutionInterceptorCallback<T>, options?: { frequency: Frequency }): void {
        this.container.afterResolution(token, callback, options);
    }

    clearInstances(): void {
        this.container.clearInstances();
    }

    createChildContainer(): IDependencyContainer {
        return new DiContainer(this.container.createChildContainer(), this);
    }

    isRegistered<T>(token: InjectionToken<T>, recursive?: boolean): boolean {
        return this.container.isRegistered(token, recursive);
    }

    register<T>(token: InjectionToken<T>, provider: ValueProvider<T>): IDependencyContainer;
    register<T>(token: InjectionToken<T>, provider: FactoryProvider<T>): IDependencyContainer;
    register<T>(token: InjectionToken<T>, provider: TokenProvider<T>, options?: RegistrationOptions): IDependencyContainer;
    register<T>(token: InjectionToken<T>, provider: ClassProvider<T>, options?: RegistrationOptions): IDependencyContainer;
    register<T>(token: InjectionToken<T>, provider: Type<T>, options?: RegistrationOptions): IDependencyContainer;
    register(token, provider, options?: RegistrationOptions): IDependencyContainer {
        if (isFactoryProvider(provider)) {
            this.container.register(token, {
                useFactory: dc => {
                    return provider.useFactory(dc["wrapperContainer"]);
                }
            });
            return this.addToken(token);
        }
        this.container.register(token, provider);
        return this.addToken(token);
    }

    registerInstance<T>(token: InjectionToken<T>, instance: T): IDependencyContainer {
        this.container.registerInstance(token, instance);
        return this.addToken(token);
    }

    registerSingleton<T>(from: InjectionToken<T>, to: InjectionToken<T>): IDependencyContainer;
    registerSingleton<T>(token: Type<T>): IDependencyContainer;
    registerSingleton(from, to?): IDependencyContainer {
        this.container.registerSingleton(from, to);
        return this.addToken(from);
    }

    registerType<T>(from: InjectionToken<T>, to: InjectionToken<T>): IDependencyContainer {
        this.container.registerType(from, to);
        return this.addToken(from);
    }

    reset(): void {
        this.tokens = [];
        this.tokenSet = new Set<InjectionToken>();
        this.container.reset();
    }

    resolve<T>(token: InjectionToken<T>): T {
        return this.container.resolve(token);
    }

    resolveAll<T>(token: InjectionToken<T>): T[] {
        return this.container.resolveAll(token);
    }

    get<T>(token: InjectionToken<T>): T {
        return this.container.resolve(token);
    }

    protected addToken<T>(token: InjectionToken<T>): this {
        if (this.tokenSet.has(token)) return this;
        this.tokenSet.add(token);
        this.tokens.push(token);
        if (isString(token)) {
            this.myTree.addPath(token);
        }
        return this;
    }
}
