import {Injectable} from "injection-js";
import {Parameter} from "../common-types";
import {convertValue, getType, isFunction} from "../utils";
import {Logger} from "./logger";

@Injectable()
export class Configuration {

    protected paramMap: {[name: string]: Parameter};

    constructor(readonly logger: Logger) {
        this.paramMap = {};
    }

    add(param: Parameter): void {
        this.paramMap[param.name] = param;
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
