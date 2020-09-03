import {Injectable} from "injection-js";
import {Authorized, Controller, Get, HttpError, Param, Post, UploadedFile} from "routing-controllers";
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
            this.assets.writeBuffer(file.buffer, file.mimetype, {filename: file.filename})
                .then(id => {
                    resolve({_id: id, id});
                })
                .catch(reason => {
                    reject({httpCode: 400, message: reason});
                });
        });
    }

    @Get("/image/:id/:rotation")
    async getImageRotation(@Param("id") id: string, @Param("rotation") rotation: number = 0) {
        const asset = await this.assets.read(id);
        if (!asset) {
            return new HttpError(404, `Image with id: '${id}' not found.`);
        }
        if (asset.metadata?.classified) {
            return new HttpError(403, `Image is classified, and can be only downloaded from a custom url.`);
        }
        return asset.getImage(rotation);
    }

    @Get("/image/:id")
    async getImage(@Param("id") id: string) {
        return this.getImageRotation(id);
    }

    @Get("/:id")
    async getFile(@Param("id") id: string) {
        const asset = await this.assets.read(id);
        if (!asset) {
            return new HttpError(404, `File with id: '${id}' not found.`);
        }
        if (asset.metadata?.classified) {
            return new HttpError(403, `Asset is classified, and can be only downloaded from a custom url.`);
        }
        return asset.stream;
    }
}
