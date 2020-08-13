import {Response} from "express";
import {Injectable} from "injection-js";
import {Controller, Get, Param, Res} from "routing-controllers";
import {Gallery} from "../services/gallery";

@Injectable()
@Controller("/gallery")
export class GalleryController {

    constructor(readonly gallery: Gallery) { }

    @Get("/:id")
    getFile(@Param("id") id: string, @Res() res: Response) {
        return this.gallery.getImage(id);
    }
}
