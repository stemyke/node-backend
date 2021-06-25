import {injectable, singleton} from "tsyringe";
import axios from "axios";
import {Configuration} from "./configuration";
import {ITranslations} from "../common-types";

@injectable()
@singleton()
export class TranslationProvider {

    protected cache: { [lang: string]: Promise<ITranslations> };

    constructor(readonly config: Configuration) {
        this.cache = {};
    }

    getDictionary(language: string): Promise<ITranslations> {
        this.cache[language] = this.cache[language] || axios.get(this.config.resolve("translationsTemplate").replace(`[lang]`, language)).then(
            r => r.data,
            reason => ({
                message: reason
            })
        );
        return this.cache[language];
    }
}
