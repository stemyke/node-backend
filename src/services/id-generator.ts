import {injectable, Lifecycle, scoped} from "tsyringe";
import {Configuration} from "./configuration";
import {rand} from "../utils";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class IdGenerator {

    protected prefix: string;
    protected separator: string;
    protected chars: string;
    protected parts: number[];

    constructor(readonly config: Configuration) {
        this.prefix = config.resolve("idPrefix");
        this.separator = config.resolve("idSeparator");
        this.chars = config.resolve("idChars");
        this.parts = config.resolve("idParts");
    }

    async generate(checkCb: (id: string) => Promise<boolean>): Promise<string> {
        let id = null;
        let tries = 0;
        let notGood = true;
        while (notGood && tries < 5) {
            id = this.generateId();
            notGood = await checkCb(id);
            tries++;
        }
        if (notGood) {
            throw `Couldn't generate an unique id..`;
        }
        return id;
    }

    private generateId(): string {
        return this.prefix + this.parts.map(num => {
            let s = "";
            for (let i = 0; i < num; i++) {
                const ix = rand(0, this.chars.length - 1);
                s += this.chars[ix];
            }
            return s;
        }).join(this.separator);
    }
}
