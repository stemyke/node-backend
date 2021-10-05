import {injectable, Lifecycle, scoped} from "tsyringe";
import {Express} from "express";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class EndpointProvider {

    async configure(app: Express): Promise<any> {
        console.log(`Express app is mounted to: ${app.mountpath}`);
    }
}
