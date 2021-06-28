import {inject, injectable} from "tsyringe";
import {ExpressMiddlewareInterface, Middleware} from "routing-controllers";
import {DI_CONTAINER, IRequest} from "../common-types";
import {DependencyContainer} from "tsyringe";

@injectable()
@Middleware({ type: "before" })
export class ContainerMiddleware implements ExpressMiddlewareInterface {

    constructor(@inject(DI_CONTAINER) readonly container: DependencyContainer) {

    }

    use(request: IRequest, response: any, next: (err?: any) => any): void {
        request.container = this.container;
        next(null);
    }
}
