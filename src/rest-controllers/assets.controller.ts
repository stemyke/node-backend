import {Readable} from "stream";
import {Response} from "express";
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
import {IAsset} from "../common-types";
import {Assets} from "../services/assets";
import {AssetResolver} from "../services/asset-resolver";
import {AssetImageParams} from "../requests/asset-image-params";

type AssetReqType = 'Image' | 'Asset';

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

    @Get("/:id")
    async getFile(@Param("id") id: string, @QueryParam("lazy") lazy: boolean, @Res() res: Response): Promise<Readable> {
        const asset = await this.getAsset("Asset", id, lazy, res);
        return asset.download();
    }

    @Get("/metadata/:id")
    async getMetadata(@Param("id") id: string, @QueryParam("lazy") lazy: boolean, @Res() res: Response): Promise<any> {
        const asset = await this.assetResolver.resolve(id, lazy);
        if (!asset) {
            throw new HttpError(404, `Asset with id: '${id}' not found.`);
        }
        return asset.metadata;
    }

    @Get("/image/:id/:rotation")
    async getImageRotation(@Param("id") id: string, @QueryParams() params: AssetImageParams, @Res() res: Response, @Param("rotation") rotation: number = 0): Promise<Readable> {
        const asset = await this.getAsset("Image", id, params.lazy, res);
        if (rotation !== 0) {
            params.rotation = params.rotation || rotation;
        }
        return asset.downloadImage(params);
    }

    @Get("/image/:id")
    async getImage(@Param("id") id: string, @QueryParams() params: AssetImageParams, @Res() res: Response): Promise<Readable> {
        return this.getImageRotation(id, params, res);
    }

    @Get("/by-name/:name")
    async getFileByName(@Param("name") name: string, @Res() res: Response): Promise<Readable> {
        const asset = await this.getAssetByName("Asset", name, res);
        return asset.download();
    }

    @Get("/by-name/image/:name")
    async getImageByName(@Param("name") name: string, @QueryParams() params: AssetImageParams, @Res() res: Response): Promise<Readable> {
        const asset = await this.getAssetByName("Image", name, res);
        return asset.downloadImage(params);
    }

    protected setAssetHeaders(asset: IAsset, res: Response): void {
        const ext = asset.metadata?.extension;
        if (ext) {
            res.header("content-disposition", `inline; filename=${asset.filename}.${ext}`);
        }
        if (asset.contentType) {
            res.header("content-type", asset.contentType);
        }
    }

    protected async getAsset(type: AssetReqType, id: string, lazy: boolean, res: Response): Promise<IAsset> {
        let asset = await this.assetResolver.resolve(id, lazy);
        if (!asset) {
            throw new HttpError(404, `${type} with id: '${id}' not found.`);
        }
        asset = await this.resolveFinalAsset(type, asset);
        this.setAssetHeaders(asset, res);
        return asset;
    }

    protected async getAssetByName(type: AssetReqType, filename: string, res: Response): Promise<IAsset> {
        let asset = await this.assets.find({filename});
        if (!asset) {
            throw new HttpError(404, `${type} with filename: '${filename}' not found.`);
        }
        asset = await this.resolveFinalAsset(type, asset);
        this.setAssetHeaders(asset, res);
        return asset;
    }

    protected async resolveFinalAsset(type: AssetReqType, asset: IAsset): Promise<IAsset> {
        if (asset.metadata?.classified) {
            throw new HttpError(403, `${type} is classified, and can be only downloaded from a custom url.`);
        }
        if (type == 'Image' && asset.metadata.preview) {
            return this.resolveFinalAsset(type, await this.assetResolver.resolve(asset.metadata.preview));
        }
        return asset;
    }
}
