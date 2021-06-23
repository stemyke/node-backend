import {ExpressMiddlewareInterface, Middleware} from "routing-controllers";
import {IRequest} from "../common-types";
import {DependencyContainer} from "tsyringe";

@Middleware({ type: "before" })
export class ContainerMiddleware implements ExpressMiddlewareInterface {

    constructor(readonly container: DependencyContainer) {

    }

    use(request: IRequest, response: any, next: (err?: any) => any): void {
        request.injector = this.injector;
        next(null);
    }
}
