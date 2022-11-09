import {singleton} from "tsyringe";
import {rand} from "../utils";

@singleton()
export class TokenGenerator {

    protected chars: string;

    constructor() {
        this.chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    }

    async generate(checkCb: (token: string) => Promise<boolean>): Promise<string> {
        let token = null;
        let tries = 0;
        let notGood = true;
        while (notGood && tries < 5) {
            token = this.generateToken();
            notGood = await checkCb(token);
            tries++;
        }
        if (notGood) {
            throw new Error(`Couldn't generate an unique token..`);
        }
        return token;
    }

    private generateToken(): string {
        let s = "";
        for (let i = 0; i < 15; i++) {
            const ix = rand(0, this.chars.length - 1);
            s += this.chars[ix];
        }
        return s;
    }
}
