import {Injectable} from "injection-js";
import {getValue, isDefined, isString} from "../utils";
import {ITranslations} from "../common-types";
import {TranslationProvider} from "./translation-provider";

@Injectable()
export class Translator {

    protected cache: { [lang: string]: ITranslations };

    constructor(private translationProvider: TranslationProvider) {
        this.cache = {};
    }

    async getDictionary(language: string): Promise<ITranslations> {
        const dictionary = await this.translationProvider.getDictionary(language);
        this.cache[language] = dictionary;
        return dictionary;
    }

    getTranslationSync(language: string, key: string, params?: any): string {
        if (!isString(key) || !key.length) {
            throw new Error(`Parameter "key" required`);
        }
        const dictionary = this.cache[language];
        const translation = getValue(dictionary, key, key) || key;
        return this.interpolate(translation, params);
    }

    getTranslation(language: string, key: string, params?: any): Promise<string> {
        if (!isString(key) || !key.length) {
            throw new Error(`Parameter "key" required`);
        }
        return this.getDictionary(language).then(dictionary => {
            const translation = getValue(dictionary, key, key) || key;
            return this.interpolate(translation, params);
        });
    }

    getTranslations(language: string, ...keys: string[]): Promise<ITranslations> {
        return new Promise<ITranslations>(resolve => {
            Promise.all(keys.map(key => this.getTranslation(language, key))).then(translations => {
                resolve(keys.reduce((result, key, i) => {
                    result[key] = translations[i];
                    return result;
                }, {}));
            });
        });
    }

    protected interpolate(expr: string | Function, params?: any): string {
        if (typeof expr === "string") {
            return this.interpolateString(expr, params);
        }
        if (typeof expr === "function") {
            return expr(params);
        }
        return expr as string;
    }

    protected interpolateString(expr: string, params?: any) {
        if (!expr || !params) return expr;
        return expr.replace(/{{\s?([^{}\s]*)\s?}}/g, (substring: string, b: string) => {
            const r = getValue(params, b);
            return isDefined(r) ? r : substring;
        });
    }
}
