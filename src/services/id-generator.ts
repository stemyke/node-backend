import {Injectable} from "injection-js";
import {v4 as uuidv4} from "uuid";

@Injectable()
export class IdGenerator {

    constructor() {

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
        return uuidv4();
    }
}
