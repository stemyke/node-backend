import {injectable, injectAll, scoped, Lifecycle} from "tsyringe";
import {PARAMETER, Parameter} from "../common-types";
import {convertValue, getType, isFunction} from "../utils";
import dotenv from "dotenv";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class Configuration {

    protected paramMap: {[name: string]: Parameter};

    constructor(@injectAll(PARAMETER) params: Parameter[]) {
        dotenv.config();
        this.paramMap = {};
        (params || []).forEach(param => this.add(param));
    }

    protected add(param: Parameter): void {
        const existingParam = this.paramMap[param.name] || param;
        existingParam.defaultValue = param.defaultValue;
        existingParam.resolver = param.resolver || existingParam.resolver;
        this.paramMap[param.name] = existingParam;
    }

    hasParam(name: string): boolean {
        return !!this.paramMap[name];
    }

    resolve(name: string): any {
        const param = this.paramMap[name];
        if (!param) throw new Error(`Parameter with name: '${name}' does not exists in configuration`);
        const envName = param.name.replace(/\.?([A-Z|0-9]+)/g, function (x,y){
            return "_" + y.toLowerCase()
        }).replace(/\./gi, "_").replace(/^_/, "").toUpperCase();
        const envValue = process.env[envName];
        if (typeof envValue !== "undefined") {
            return isFunction(param.resolver)
                ? param.resolver(envValue)
                : convertValue(envValue, getType(param.defaultValue));
        }
        return param.defaultValue;
    }
}
