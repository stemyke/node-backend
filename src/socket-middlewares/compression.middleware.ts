import { Middleware, MiddlewareInterface } from 'socket-controllers';

@Middleware()
export class CompressionMiddleware implements MiddlewareInterface {

    use(socket: any, next: (err?: any) => any) {
        next();
    }
}
