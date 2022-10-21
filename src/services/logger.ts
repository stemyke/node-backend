import {singleton} from "tsyringe";
import {Configuration} from "./configuration";

@singleton()
export class Logger {

    protected tags: string[];

    constructor(readonly config: Configuration) {
        console.log("Logger created");
        this.tags = this.config.resolve("logTags");
    }

    log(tag: string, ...params: any[]): void {
        if (!this.tags.includes(tag)) {
            console.log(`[${tag}]`, ...params);
        }
    }
}
