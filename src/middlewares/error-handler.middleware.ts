import {BadRequestError, ExpressErrorMiddlewareInterface, HttpError, Middleware} from "routing-controllers";
import {Response} from "express";
import {Injectable} from "injection-js";
import {Translator} from "../services/translator";
import {ParamRequiredError} from "routing-controllers/error/ParamRequiredError";
import {IRequest} from "../common-types";

@Injectable()
@Middleware({ type: "after" })
export class ErrorHandlerMiddleware implements ExpressErrorMiddlewareInterface {

    constructor(readonly translator: Translator) {

    }

    async error(error: any, req: IRequest, res: Response, next: (err?: any) => any) {

        const result: any = {};
        const isDev = process.env.NODE_ENV === "development";

        if (error instanceof ParamRequiredError) {
            res.status(400);
            result.message = await this.translator.getTranslation(req.language, "message.parameter-required.error");
            result.param = error.message;
        } else if (error instanceof BadRequestError) {
            res.status(400);
            result.message = await this.translator.getTranslation(req.language, "message.form-validation.error");
            result.errors = error["errors"];
            result.stack = error.stack;
        } else {
            // set http status
            if (error instanceof HttpError && error.httpCode) {
                res.status(error.httpCode);
            } else {
                res.status(500);
            }

            if (error instanceof Error) {
                if (error.name) {
                    result.name = error.name;
                }
                if (error.message) {
                    result.message = error.message;
                }
                if (error.stack && isDev) {
                    result.stack = error.stack;
                }
            } else if (typeof error === "string") {
                result.message = error;
            }
        }

        res.json(result);
    }
}
