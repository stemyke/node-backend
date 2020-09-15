import {Injectable} from "injection-js";
import {Controller, Get, Param} from "routing-controllers";
import {GalleryCache} from "../services/gallery-cache";

@Injectable()
@Controller("/gallery")
export class GalleryController {

    constructor(readonly galleryCache: GalleryCache) { }

    @Get("/:id")
    getFile(@Param("id") id: string) {
        return this.galleryCache.serve(id);
    }
}
