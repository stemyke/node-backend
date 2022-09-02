import {injectable, Lifecycle, scoped} from "tsyringe";
import {IJob} from "../common-types";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class EmptyJob implements IJob {

    async process(): Promise<any> {
        return null;
    }
}
