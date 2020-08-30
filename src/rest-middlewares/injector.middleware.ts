import {ExpressMiddlewareInterface, Middleware} from "routing-controllers";
import {Injector} from "injection-js";
import {IRequest} from "../common-types";

@Middleware({ type: "before" })
export class InjectorMiddleware implements ExpressMiddlewareInterface {

    constructor(readonly injector: Injector) {

    }

    use(request: IRequest, response: any, next: (err?: any) => any): void {
        request.injector = this.injector;
        next(null);
    }

}
