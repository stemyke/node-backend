import {IUser} from "../common-types";

const sampleUser: IUser = {
    id: "",
    email: "admin@site.com",
    password: ""
};

export class UserManager {

    async getByCredentials(credentials: any): Promise<IUser> {
        return (sampleUser.email == credentials.email) ? sampleUser : await Promise.reject("message.login.error");
    }

    async getById(email: string): Promise<IUser> {
        return (sampleUser.email == email) ? sampleUser : null;
    }

    serialize(user: IUser): any {
        const res = Object.assign({}, user);
        delete res.password;
        return res;
    }
}
