import {ExpressMiddlewareInterface, Middleware} from "routing-controllers";
import moment from "moment";
import {IRequest} from "../common-types";

@Middleware({ type: "after" })
export class RequestEndedMiddleware implements ExpressMiddlewareInterface {

    use(request: IRequest, response: any, next: (err?: any) => any): void {
        request.ended = moment();
        const diff = request.ended.diff(request.started);
        const duration = moment.duration(diff);
        console.log(`Request '${request.id}' ended at: ${request.ended.format("YYYY-MM-DD HH:mm:ss")} [${request.method}] ${request.url}`);
        console.log(`Request '${request.id}' lasted: ${duration.asMilliseconds()}ms`)
        next(null);
    }

}
