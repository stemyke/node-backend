import {Injectable} from "injection-js";
import {Authorized, Controller, Get, Param, Post, UploadedFile} from "routing-controllers";
import {Assets} from "../services/assets";

@Injectable()
@Controller("/assets")
export class AssetsController {

    constructor(readonly assets: Assets) {

    }

    @Authorized("admin")
    @Post("")
    upload(@UploadedFile("file") file: Express.Multer.File) {
        return new Promise<any>((resolve, reject) => {
            this.assets.writeBuffer(file.buffer, file.mimetype, file.filename)
                .then(id => {
                    resolve({_id: id, id});
                })
                .catch(reason => {
                    reject({httpCode: 400, message: reason});
                });
        });
    }

    @Get("/:id")
    getFile(@Param("id") id: string) {
        return this.assets.read(id);
    }
}
