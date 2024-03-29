import {Response} from "express";
import webToken from "jsonwebtoken";
import {injectable} from "tsyringe";
import {
    Authorized,
    Body,
    Controller,
    CurrentUser,
    Get,
    HttpError,
    Post,
    Res,
    UnauthorizedError
} from "routing-controllers";
import {compare} from "bcrypt";

import {Configuration} from "../services/configuration";
import {UserManager} from "../services/user-manager";
import {IUser} from "../common-types";

@injectable()
@Controller()
export class AuthController {

    constructor(readonly config: Configuration, readonly userManager: UserManager) {}

    @Post("/login")
    async login(@Body() credentials: any, @Res() res: Response) {
        let user: IUser = null;
        try {
            user = await this.userManager.getByCredentials(credentials);
        } catch (reason) {
            throw new HttpError(401, reason);
        }
        const valid = !user ? false : await compare(credentials.password, user.password);
        if (valid !== true)
            throw new UnauthorizedError(`message.login.error`);
        return {
            token: webToken.sign({ id: user._id || user.id }, this.config.resolve("jwtSecret")),
            user: await this.userManager.serialize(user)
        };
    }

    @Authorized()
    @Get("/user")
    getProfile(@CurrentUser() user: IUser) {
        return this.userManager.serialize(user);
    }
}
