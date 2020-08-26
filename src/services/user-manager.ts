import {IUser} from "../common-types";

const sampleUser: IUser = {
    id: "5a3cdf7c6a9cf0ba32feccdf",
    email: "admin@site.com",
    password: "",
    roles: ["admin"]
};

export class UserManager {

    async getByCredentials(credentials: any): Promise<IUser> {
        return (sampleUser.email == credentials.email) ? sampleUser : await Promise.reject("message.login.error");
    }

    async getById(id: string): Promise<IUser> {
        return (sampleUser.id == id) ? sampleUser : null;
    }

    async serialize(user: IUser): Promise<any> {
        const res = Object.assign({}, user);
        delete res.password;
        return res;
    }
}
