import {Response} from "express";
import {sign} from "jsonwebtoken";
import {Injectable} from "injection-js";
import {Authorized, Body, Controller, CurrentUser, Get, HttpError, Post, Res} from "routing-controllers";
import {compare} from "bcrypt";

import {Configuration} from "../services/configuration";
import {UserManager} from "../services/user-manager";
import {IUser} from "../common-types";

@Injectable()
@Controller()
export class AuthController {

    constructor(readonly config: Configuration, readonly userManager: UserManager) {}

    @Post("/login")
    async login(@Body() credentials: any, @Res() res: Response) {
        try {
            const user = await this.userManager.getByCredentials(credentials);
            const valid = await compare(credentials.password, user.password);
            if (valid !== true) throw "message.login.error";
            return {
                token: sign({ id: user._id || user.id }, this.config.resolve("jwtSecret")),
                user: await this.userManager.serialize(user)
            };
        } catch (reason) {
            throw new HttpError(401, reason);
        }
    }

    @Authorized()
    @Get("/user")
    getProfile(@CurrentUser() user: IUser) {
        return this.userManager.serialize(user);
    }
}
