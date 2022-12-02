import {singleton} from "tsyringe";
import axios from "axios";
import {isObject} from "../utils";
import {Configuration} from "./configuration";
import {ITranslations} from "../common-types";
import {Cache} from "./cache";

@singleton()
export class TranslationProvider {

    constructor(readonly config: Configuration, readonly cache: Cache) {

    }

    getDictionary(language: string): Promise<ITranslations> {
        return this.cache.getOrSet(`translations-${language}`, async () => {
            try {
                const url = this.config.resolve("translationsTemplate")
                    .replace(`__lang__`, language)
                    .replace(`[lang]`, language);
                const data = await axios.get(url).then(t => t.data);
                if (isObject(data[language])) {
                    return data[language];
                }
                return data;
            } catch (e) {
                return {
                    message: `${e}`
                }
            }
        }, 5 * 60);
    }
}
