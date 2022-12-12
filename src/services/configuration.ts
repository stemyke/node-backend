import {injectAll, singleton} from "tsyringe";
import dotenv from "dotenv";

import {PARAMETER, Parameter} from "../common-types";
import {colorize, ConsoleColor, convertValue, getType, isFunction} from "../utils";

@singleton()
export class Configuration {

    protected paramMap: {[name: string]: Parameter};
    protected paramValues: {[name: string]: any};

    constructor(@injectAll(PARAMETER) params: Parameter[]) {
        dotenv.config();
        this.paramMap = {};
        this.paramValues = {};
        (params || []).forEach(param => this.add(param));
    }

    protected add(param: Parameter): void {
        const existingParam = this.paramMap[param.name] || param;
        existingParam.defaultValue = param.defaultValue;
        existingParam.resolver = param.resolver || existingParam.resolver;
        this.paramMap[param.name] = existingParam;
    }

    protected resolveValue(param: Parameter): any {
        const envName = param.name.replace(/\.?([A-Z|0-9]+)/g, function (x, y) {
            return "_" + y.toLowerCase()
        }).replace(/\./gi, "_").replace(/^_/, "").toUpperCase();
        const envValue = process.env[envName];
        if (typeof envValue !== "undefined") {
            const value = isFunction(param.resolver)
                ? param.resolver(envValue)
                : convertValue(envValue, getType(param.defaultValue));
            console.log(
                colorize(`Processing param value`, ConsoleColor.FgYellow),
                colorize(param.name, ConsoleColor.FgGreen),
                colorize(envName, ConsoleColor.FgBlue),
                `"${envValue}"`,
                value
            );
            return value;
        } else if (isFunction(param.resolver)) {
            const value = param.resolver(param.defaultValue);
            console.log(
                colorize(`Processing default param value`, ConsoleColor.FgYellow),
                colorize(param.name, ConsoleColor.FgGreen),
                param.defaultValue,
                value
            );
            return value;
        }
        console.log(
            colorize(`Using default param value`, ConsoleColor.FgYellow),
            colorize(param.name, ConsoleColor.FgGreen),
            param.defaultValue,
        );
        return param.defaultValue;
    }

    hasParam(name: string): boolean {
        return !!this.paramMap[name];
    }

    resolve(name: string): any {
        const param = this.paramMap[name];
        if (!param) throw new Error(`Parameter with name: '${name}' does not exists in configuration`);
        if (!(name in this.paramValues)) {
            this.paramValues[name] = this.resolveValue(param);
        }
        return this.paramValues[name];
    }
}
