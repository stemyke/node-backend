import {injectable} from "tsyringe";
import {ExpressMiddlewareInterface, Middleware} from "routing-controllers";
import {IRequest} from "../common-types";
import {Configuration} from "../services/configuration";

@injectable()
@Middleware({ type: "before" })
export class LanguageMiddleware implements ExpressMiddlewareInterface {

    constructor(readonly config: Configuration) {

    }

    use(request: IRequest, response: any, next: (err?: any) => any): void {
        request.language = request.query.language as string || this.config.resolve("defaultLanguage");
        next(null);
    }

}
