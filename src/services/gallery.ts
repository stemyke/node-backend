import {Injectable} from "injection-js";
import {v4 as uuidv4} from "uuid";
import rimraf_ from "rimraf";
import sharp_ from "sharp";
import {Sharp, Metadata} from "sharp";
import {join} from "path";
import {readdir, lstat, mkdir} from "fs";
import {IGalleryImage, IGallerySize} from "../common-types";
import * as Buffer from "buffer";
import {Configuration} from "./configuration";
import {GalleryCache} from "./gallery-cache";

const thumbSize = 250;
const bigSize = 1500;

const rimraf = rimraf_;
const sharp = sharp_;

class GalleryImage implements IGalleryImage {

    readonly thumb: string;

    readonly big: string;

    protected bigFilePath: Promise<string>;
    protected thumbFilePath: Promise<string>;

    constructor(readonly path: string, readonly folder: string, protected origSize: IGallerySize, protected targetSize: IGallerySize, protected output: string) {
        this.thumb = uuidv4();
        this.big = uuidv4();
    }

    serve(id: string): Promise<Buffer> {
        const isThumb = id == this.thumb;
        const ratio = this.origSize.width / this.origSize.height;
        const sizeRatio = isThumb ? this.targetSize.width / this.targetSize.height : 1;
        const size = isThumb ? Math.max(this.targetSize.width, this.targetSize.height) : bigSize;
        const height = ratio > sizeRatio ? size : Math.round(size / ratio);
        const width = Math.round(height * ratio);

        if (isThumb) {
            this.thumbFilePath = this.thumbFilePath || new Promise<string>(async resolve => {
                const path = join(this.output, this.thumb);
                const thumbImg = sharp();
                this.thumbImg
                    .resize(width, height)
                    .extract({
                        left: Math.floor((width - this.targetSize.width) / 2),
                        top: Math.floor((height - this.targetSize.height) / 2),
                        width: this.targetSize.width,
                        height: this.targetSize.height
                    })
                    .toFile(path)
                    .then(() => resolve(path));
            });
        } else {
            this.bigFilePath = this.bigFilePath || new Promise<string>(resolve => {
                const path = join(this.output, this.big);
                this.bigImg
                    .resize(width, height)
                    .toFile(path)
                    .then(() => resolve(path));
            });
        }
        return (isThumb ? this.thumbFilePath : this.bigFilePath).then(path => {
            return sharp(path).toBuffer();
        });
    }
}

@Injectable()
export class Gallery {

    private readonly dir: string;
    private readonly cache: { [folder: string]: Promise<IGalleryImage[]> };
    private readonly output: string;
    private readonly init: Promise<any>;

    constructor(readonly config: Configuration, readonly galleryCache: GalleryCache) {
        this.dir = join(__dirname, "..", "gallery");
        this.cache = {};
        this.output = join(this.config.resolve("cacheDir"), "gallery");
        this.init = new Promise<any>((resolve, reject) => {
            rimraf(this.output, error => {
                if (error) {
                    reject(error);
                    return;
                }
                mkdir(this.output, { recursive: true }, resolve);
            });
        });
    }

    async getFolder(folder: string, size: IGallerySize = null): Promise<IGalleryImage[]> {
        await this.init;
        const path = join(this.dir, folder);
        size = !size ? {width: thumbSize, height: thumbSize} : size;
        this.cache[folder] = this.cache[folder] || new Promise<IGalleryImage[]>(resolve => {
            lstat(path, (err, stats) => {
                if (err || !stats.isDirectory()) {
                    resolve([]);
                    return;
                }
                this.readRecursive(path, "", size).then(resolve, () => resolve([]));
            });
        });
        return this.cache[folder];
    }

    protected readRecursive(path: string, folder: string, size: IGallerySize): Promise<IGalleryImage[]> {
        return new Promise<IGalleryImage[]>(resolve => {
            readdir(path, (err, files) => {
                if (err) {
                    resolve([]);
                    return;
                }
                const promises = files.map(file => {
                    return new Promise<IGalleryImage[]>(async resolve => {
                        const filePath = join(path, file);
                        lstat(filePath, (err, stats) => {
                            if (err) {
                                resolve([]);
                                return;
                            }
                            if (stats.isDirectory()) {
                                this.readRecursive(filePath, join(folder, file), size).then(resolve);
                                return;
                            }
                            const sharpImg = sharp(filePath);
                            sharpImg.rotate().metadata().then(async meta => {

                                const galleryImg = new GalleryImage(filePath, folder, meta, size, this.output);
                                this.galleryCache.put(galleryImg);

                                resolve([galleryImg]);
                            }, () => resolve([]));
                        });
                    });
                });
                Promise.all(promises).then(folders => {
                    resolve([].concat.apply([], folders));
                });
            });
        });
    }
}
