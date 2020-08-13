import { Middleware, MiddlewareInterface } from 'socket-controllers';

@Middleware()
export class CompressionMiddleware implements MiddlewareInterface {
    use(socket: any, next: (err?: any) => any) {
        console.log('do something, for example get authorization token and check authorization');
        next();
    }
}
