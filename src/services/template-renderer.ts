import {lstatSync, readdir, readFileSync} from "fs";
import {join} from "path";
import {injectable, singleton} from "tsyringe";
import * as Handlebars from "handlebars";

import {Translator} from "./translator";
import {Configuration} from "./configuration";

@injectable()
@singleton()
export class TemplateRenderer {

    templates: {[name: string]: Function};

    protected initPromise: Promise<any>;

    constructor(readonly translator: Translator, readonly config: Configuration) {
        this.templates = {};
        Handlebars.registerHelper(`object`, function({hash}) {
            return hash;
        });
        Handlebars.registerHelper(`now`, function() {
            return new Date().getTime();
        });
        Handlebars.registerHelper(`keys`, function(obj: any) {
            return !obj ? [] : Object.keys(obj);
        });
        Handlebars.registerHelper(`translate`, function (key: string, params: any) {
            return translator.getTranslationSync(this.language, key, params);
        });
    }

    protected init(): Promise<any> {
        this.initPromise = this.initPromise || this.parseTemplates(this.config.resolve("templatesDir"), []);
        return this.initPromise;
    }

    async parseTemplates(dir: string, dirPath: string[]): Promise<any> {
        return new Promise<any>(resolve => {
            readdir(dir, async (err, files) => {
                for (let file of files) {
                    const path = join(dir, file);
                    if (lstatSync(path).isDirectory()) {
                        await this.parseTemplates(join(dir, file), dirPath.concat([file]));
                        continue;
                    }
                    const parts = file.split(".");
                    parts.pop();
                    const name = parts.join(".");
                    const fullName = dirPath.concat([name]).join("-");
                    const content = readFileSync(path).toString("utf8");
                    this.templates[fullName] = Handlebars.compile(content);
                    Handlebars.registerPartial(fullName, content);
                }
                resolve();
            });
        });
    }

    async render(template: string, language: string, context?: any): Promise<string> {
        await this.init();
        await this.translator.getDictionary(language);
        if (!this.templates[template]) {
            return Promise.reject(`Template not found with name: ${template}`);
        }
        context = Object.assign({language}, context || {});
        const res = this.templates[template](context);
        return res instanceof Error ? await Promise.reject(res) : res;
    }
}
