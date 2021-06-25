import {injectable, Lifecycle, scoped} from "tsyringe";
import {IGalleryImage, IGalleryImageHandler, IGallerySize} from "../common-types";
import {GalleryImage} from "./gallery-image";

@injectable()
@scoped(Lifecycle.ContainerScoped)
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

    create(folder: string, targetSize: IGallerySize, handler: IGalleryImageHandler): IGalleryImage {
        const image = new GalleryImage(folder, targetSize, handler);
        this.put(image);
        return image;
    }
}
