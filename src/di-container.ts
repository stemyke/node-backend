import {
    ClassProvider,
    DependencyContainer,
    FactoryProvider,
    InjectionToken,
    isFactoryProvider,
    RegistrationOptions,
    TokenProvider,
    ValueProvider
} from "tsyringe";
import {
    PostResolutionInterceptorCallback,
    PreResolutionInterceptorCallback
} from "tsyringe/dist/typings/types/dependency-container";
import {Type} from "./common-types";

type Frequency = "Always" | "Once";

type InterceptorOptions = {
    frequency: Frequency;
};

export class DiContainer implements DependencyContainer {

    get registeredTokens(): ReadonlyArray<InjectionToken> {
        return this.tokens;
    }

    protected tokens: Array<InjectionToken>;
    protected tokenSet: Set<InjectionToken>;

    constructor(protected container: DependencyContainer, protected parent: DiContainer) {
        this.tokens = [];
        this.tokenSet = new Set<InjectionToken>();
    }

    afterResolution<T>(token: InjectionToken<T>, callback: PostResolutionInterceptorCallback<T>, options?: InterceptorOptions): void {

    }

    beforeResolution<T>(token: InjectionToken<T>, callback: PreResolutionInterceptorCallback<T>, options?: InterceptorOptions): void {

    }

    clearInstances(): void {
        this.container.clearInstances();
    }

    createChildContainer(): DiContainer {
        return new DiContainer(this.container.createChildContainer(), this);
    }

    isRegistered<T>(token: InjectionToken<T>, recursive?: boolean): boolean {
        return this.container.isRegistered(token, recursive);
    }

    register<T>(token: InjectionToken<T>, provider: ValueProvider<T>): DiContainer;
    register<T>(token: InjectionToken<T>, provider: FactoryProvider<T>): DiContainer;
    register<T>(token: InjectionToken<T>, provider: TokenProvider<T>, options?: RegistrationOptions): DiContainer;
    register<T>(token: InjectionToken<T>, provider: ClassProvider<T>, options?: RegistrationOptions): DiContainer;
    register<T>(token: InjectionToken<T>, provider: Type<T>, options?: RegistrationOptions): DiContainer;
    register(token, provider, options?: RegistrationOptions): DiContainer {
        if (isFactoryProvider(provider)) {
            return this;
        }
        this.container.registerInstance(token, provider);
        return this.addToken(token);
    }

    registerInstance<T>(token: InjectionToken<T>, instance: T): DependencyContainer {
        this.container.registerInstance(token, instance);
        return this.addToken(token);
    }

    registerSingleton<T>(from: InjectionToken<T>, to: InjectionToken<T>): DependencyContainer;
    registerSingleton<T>(token: Type<T>): DependencyContainer;
    registerSingleton(from, to?): DependencyContainer {
        this.container.registerSingleton(from, to);
        return this.addToken(from);
    }

    registerType<T>(from: InjectionToken<T>, to: InjectionToken<T>): DependencyContainer {
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

    protected addToken<T>(token: InjectionToken<T>): this {
        if (!this.tokenSet.has(token)) {
            this.tokenSet.add(token);
            this.tokens.push(token);
        }
        return this;
    }
}
