import {singleton} from "tsyringe";
import {Configuration} from "./configuration";

@singleton()
export class Logger {

    protected tags: string[];
    protected ignoredTags: string[];

    constructor(readonly config: Configuration) {
        this.tags = this.config.resolve("logTags");
        this.ignoredTags = this.config.resolve("ignoredLogTags");
    }

    log(tag: string, ...params: any[]): void {
        if (this.ignoredTags.includes(tag)) return;
        if (this.tags.length === 0 || this.tags.includes(tag)) {
            console.log(`[${tag}]`, ...params);
        }
    }
}
