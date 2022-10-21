import {injectable} from "tsyringe";
import {ExpressMiddlewareInterface, Middleware} from "routing-controllers";
import {ObjectId} from "bson";
import moment from "moment";
import {IRequest} from "../common-types";
import {Logger} from "../services/logger";

@injectable()
@Middleware({ type: "before" })
export class RequestStartedMiddleware implements ExpressMiddlewareInterface {

    constructor(readonly logger: Logger) {
    }

    use(request: IRequest, response: any, next: (err?: any) => any): void {
        request.id = new ObjectId().toHexString();
        request.started = moment();
        this.logger.log(
            "request-time",
            `Request '${request.id}' started at: ${request.started.format("YYYY-MM-DD HH:mm:ss")} [${request.method}] ${request.url}`
        );
        next(null);
    }

}
