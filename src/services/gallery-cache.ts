import {Injectable} from "injection-js";
import {IGalleryImage} from "../common-types";

@Injectable()
export class GalleryCache {

    private readonly imgCache: { [id: string]: IGalleryImage };

    constructor() {
        this.imgCache = {};
    }

    put(img: IGalleryImage): void {
        this.imgCache[img.thumb] = img;
        this.imgCache[img.big] = img;
    }

    serve(id: string): Promise<Buffer> {
        const img = this.imgCache[id];
        return !img ? null : img.serve(id);
    }
}
