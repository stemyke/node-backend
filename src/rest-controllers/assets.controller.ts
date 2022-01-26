import {Readable} from "stream";
import {injectable} from "tsyringe";
import {
    Authorized,
    Body,
    Controller,
    Get,
    HttpError,
    Param,
    Post,
    QueryParam,
    QueryParams,
    Res,
    UploadedFile
} from "routing-controllers";
import {IAsset, IAssetImageParams} from "../common-types";
import {Assets} from "../services/assets";
import {AssetResolver} from "../services/asset-resolver";
import {Response} from "express";

@injectable()
@Controller("/assets")
export class AssetsController {

    constructor(readonly assets: Assets, readonly assetResolver: AssetResolver) {

    }

    @Authorized()
    @Post("")
    async upload(@UploadedFile("file") file: Express.Multer.File) {
        try {
            const contentType = file.mimetype === "application/octet-stream" ? null : file.mimetype;
            const asset = await this.assets.writeBuffer(file.buffer, {filename: file.filename}, contentType);
            return asset.toJSON();
        } catch (e) {
            const msg = e?.message || e || "Unknown error";
            throw new HttpError(400, `Asset can't be uploaded.\n${msg}`);
        }
    }

    @Authorized()
    @Post("url")
    async uploadUrl(@Body() body: any) {
        try {
            const asset = await this.assets.writeUrl(body.url, body);
            return asset.toJSON();
        } catch (e) {
            const msg = e?.message || e || "Unknown error";
            throw new HttpError(400, `Asset can't be uploaded.\n${msg}`);
        }
    }

    @Get("/image/:id/:rotation")
    async getImageRotation(@Param("id") id: string, @QueryParams() params: IAssetImageParams, @Res() res: Response, @Param("rotation") rotation: number = 0): Promise<Readable> {
        const asset = await this.getAsset("Asset", id, params.lazy, res);
        params.rotation = params.rotation || rotation;
        return asset.downloadImage(params);
    }

    @Get("/image/:id")
    async getImage(@Param("id") id: string, @QueryParams() params: IAssetImageParams, @Res() res: Response): Promise<Readable> {
        return this.getImageRotation(id, params, res);
    }

    @Get("/:id")
    async getFile(@Param("id") id: string, @QueryParam("lazy") lazy: boolean, @Res() res: Response): Promise<Readable> {
        const asset = await this.getAsset("Asset", id, lazy, res);
        return asset.download();
    }

    protected async getAsset(type: string, id: string, lazy: boolean, res: Response): Promise<IAsset> {
        const asset = await this.assetResolver.resolve(id, lazy);
        if (!asset) {
            throw new HttpError(404, `${type} with id: '${id}' not found.`);
        }
        if (asset.metadata?.classified) {
            throw new HttpError(403, `${type} is classified, and can be only downloaded from a custom url.`);
        }
        const ext = asset.metadata?.extension;
        if (ext) {
            res.header("content-disposition", `inline; filename=${asset.filename}.${ext}`);
        }
        if (asset.contentType) {
            res.header("content-type", asset.contentType);
        }
        return asset;
    }
}
