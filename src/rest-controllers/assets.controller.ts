import {Injectable} from "injection-js";
import {
    Authorized,
    Controller,
    Get,
    HttpError,
    Param,
    Post,
    QueryParam,
    QueryParams,
    UploadedFile
} from "routing-controllers";
import {IAssetImageParams} from "../common-types";
import {Assets} from "../services/assets";
import {AssetResolver} from "../services/asset-resolver";

@Injectable()
@Controller("/assets")
export class AssetsController {

    constructor(readonly assets: Assets, readonly assetResolver: AssetResolver) {

    }

    @Authorized()
    @Post("")
    upload(@UploadedFile("file") file: Express.Multer.File) {
        return new Promise<any>((resolve, reject) => {
            this.assets.writeBuffer(file.buffer, {filename: file.filename}, file.mimetype)
                .then(asset => {
                    resolve(asset.toJSON());
                })
                .catch(reason => {
                    reject({httpCode: 400, message: reason});
                });
        });
    }

    @Get("/image/:id/:rotation")
    async getImageRotation(@Param("id") id: string, @QueryParams() params: IAssetImageParams, @Param("rotation") rotation: number = 0) {
        const asset = await this.assetResolver.resolve(id, params.lazy);
        if (!asset) {
            return new HttpError(404, `Image with id: '${id}' not found.`);
        }
        if (asset.metadata?.classified) {
            return new HttpError(403, `Image is classified, and can be only downloaded from a custom url.`);
        }
        params.rotation = params.rotation || rotation;
        return asset.getImage(params);
    }

    @Get("/image/:id")
    async getImage(@Param("id") id: string, @QueryParams() params: IAssetImageParams) {
        return this.getImageRotation(id, params);
    }

    @Get("/:id")
    async getFile(@Param("id") id: string, @QueryParam("lazy") lazy: boolean) {
        const asset = await this.assetResolver.resolve(id, lazy);
        if (!asset) {
            return new HttpError(404, `File with id: '${id}' not found.`);
        }
        if (asset.metadata?.classified) {
            return new HttpError(403, `Asset is classified, and can be only downloaded from a custom url.`);
        }
        return asset.stream;
    }
}
