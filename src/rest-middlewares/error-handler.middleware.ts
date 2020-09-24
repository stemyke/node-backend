import {BadRequestError, ExpressErrorMiddlewareInterface, Middleware} from "routing-controllers";
import {Response} from "express";
import {Injectable} from "injection-js";

import {IRequest} from "../common-types";
import {Translator} from "../services/translator";
import {Configuration} from "../services/configuration";

@Injectable()
@Middleware({ type: "after" })
export class ErrorHandlerMiddleware implements ExpressErrorMiddlewareInterface {

    get isDev(): boolean {
        return this.configuration.resolve("nodeEnv") === "development";
    }

    constructor(readonly configuration: Configuration, readonly translator: Translator) {

    }

    async error(error: any, req: IRequest, res: Response, next: (err?: any) => any) {
        const result = await this.getResult(error, req, res);
        if (this.isDev) {
            console.log(result);
        }
        res.json(result);
    }

    protected async getResult(error, req: IRequest, res: Response) {

        const result: any = {};

        if (error instanceof BadRequestError) {
            res.status(400);
            if (error.constructor.name === "ParamRequiredError") {
                result.message = await this.translator.getTranslation(req.language, "message.parameter-required.error");
                result.param = error.message;
            } else {
                result.message = error.message || await this.translator.getTranslation(req.language, "message.form-validation.error");
                result.errors = error["errors"];
                if (this.isDev) {
                    result.stack = error.stack;
                }
            }
            return result;
        }

        res.status(error.httpCode || 500);

        console.log(error);

        if (error instanceof Error) {
            if (error.name) {
                result.name = error.name;
            }
            if (error.message) {
                result.message = error.message;
            }
            if (error.stack && this.isDev) {
                result.stack = error.stack;
            }
        } else if (typeof error === "string") {
            result.message = error;
        }

        return result;
    }
}
