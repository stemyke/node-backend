import {injectable} from "tsyringe";
import {ExpressMiddlewareInterface, Middleware} from "routing-controllers";
import moment from "moment";
import {IRequest} from "../common-types";
import {Logger} from "../services/logger";

@injectable()
@Middleware({ type: "after" })
export class RequestEndedMiddleware implements ExpressMiddlewareInterface {

    constructor(readonly logger: Logger) {
    }

    use(request: IRequest, response: any, next: (err?: any) => any): void {
        request.ended = moment();
        const diff = request.ended.diff(request.started);
        const duration = moment.duration(diff);
        this.logger.log(
            "request-time",
            `Request '${request.id}' ended at: ${request.ended.format("YYYY-MM-DD HH:mm:ss")} [${request.method}] ${request.url}`
        );
        this.logger.log(
            "request-time",
            `Request '${request.id}' lasted: ${duration.asMilliseconds()}ms`
        );
        next(null);
    }

}
