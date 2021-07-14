import {injectable, scoped, Lifecycle} from "tsyringe";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class CacheProcessor {
    async serialize(data: any): Promise<any> {
        return data;
    }

    async deserialize(data: any): Promise<any> {
        return data;
    }
}
