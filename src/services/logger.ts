import {injectable, Lifecycle, scoped} from "tsyringe";
import {Configuration} from "./configuration";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class Logger {

    protected tags: string[];

    constructor(readonly config: Configuration) {
        this.tags = this.config.resolve("logTags");
    }

    log(tag: string, ...params: any[]): void {
        if (!this.tags.includes(tag)) {
            console.log(`[${tag}]`, ...params);
        }
    }
}
