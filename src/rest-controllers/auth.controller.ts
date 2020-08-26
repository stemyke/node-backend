import {Response} from "express";
import {sign} from "jsonwebtoken";
import {Injectable} from "injection-js";
import {Authorized, Body, Controller, CurrentUser, Get, Res} from "routing-controllers";
import {compare} from "bcrypt";

import {Configuration} from "../services/configuration";
import {UserManager} from "../services/user-manager";
import {IUser} from "../common-types";

@Injectable()
@Controller()
export class AuthController {

    constructor(readonly config: Configuration, readonly userManager: UserManager) {}

    @Get("/login")
    login(@Body() credentials: any, @Res() res: Response) {
        return this.userManager.getByCredentials(credentials).then(user => {
            return compare(credentials.password, user.password).then(response => {
                if (response !== true) {
                    return Promise.reject({ httpCode: 401, message: "message.login.error" });
                }
                return Promise.resolve({
                    token: sign({ id: user.id }, this.config.resolve("jwtSecret")),
                    user: this.userManager.serialize(user)
                });
            });
        }, reason => {
            return Promise.reject({ httpCode: 401, message: reason });
        });
    }

    @Authorized()
    @Get("/user")
    getProfile(@CurrentUser() user: IUser) {
        return this.userManager.serialize(user);
    }
}
