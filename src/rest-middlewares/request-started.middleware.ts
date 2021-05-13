import {ExpressMiddlewareInterface, Middleware} from "routing-controllers";
import {ObjectId} from "bson";
import moment from "moment";
import {IRequest} from "../common-types";

@Middleware({ type: "before" })
export class RequestStartedMiddleware implements ExpressMiddlewareInterface {

    use(request: IRequest, response: any, next: (err?: any) => any): void {
        request.id = new ObjectId().toHexString();
        request.started = moment();
        console.log(`Request '${request.id}' started at: ${request.started.format("YYYY-MM-DD HH:mm:ss")} [${request.method}] ${request.url}`);
        next(null);
    }

}
