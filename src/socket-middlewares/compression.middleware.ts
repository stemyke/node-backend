import {injectable} from "tsyringe";
import {Middleware, MiddlewareInterface} from "socket-controllers";

@injectable()
@Middleware()
export class CompressionMiddleware implements MiddlewareInterface {

    use(socket: any, next: (err?: any) => any) {
        next();
    }
}
