import {Injectable} from "injection-js";
import {v4 as uuidv4} from "uuid";
import * as rimraf_ from "rimraf";
import * as sharp_ from "sharp";
import {Sharp, Metadata} from "sharp";
import {join} from "path";
import {readdir, lstat, mkdir} from "fs";
import {IGalleryImage, IGallerySize} from "../common-types";
import * as Buffer from "buffer";

const thumbSize = 250;
const bigSize = 1500;
const output = join(__dirname, "..", "cache", "gallery");

const rimraf = rimraf_;
const sharp = sharp_;

class GalleryImage implements IGalleryImage {

    readonly thumb: string;

    readonly big: string;

    protected thumbImg: Sharp;
    protected bigImg: Sharp;
    protected bigFilePath: Promise<string>;
    protected thumbFilePath: Promise<string>;

    constructor(img: Sharp, readonly meta: Metadata, readonly folder: string, protected size: IGallerySize) {
        this.thumb = uuidv4();
        this.thumbImg = img.clone();
        this.big = uuidv4();
        this.bigImg = img.clone();
    }

    serve(id: string): Promise<Buffer> {
        const isThumb = id == this.thumb;
        const ratio = this.meta.width / this.meta.height;
        const sizeRatio = isThumb ? this.size.width / this.size.height : 1;
        const size = isThumb ? Math.max(this.size.width, this.size.height) : bigSize;
        const height = ratio > sizeRatio ? size : Math.round(size / ratio);
        const width = Math.round(height * ratio);

        if (isThumb) {
            this.thumbFilePath = this.thumbFilePath || new Promise<string>(resolve => {
                const path = join(output, this.thumb);
                this.thumbImg
                    .resize(width, height)
                    .extract({
                        left: Math.floor((width - this.size.width) / 2),
                        top: Math.floor((height - this.size.height) / 2),
                        width: this.size.width,
                        height: this.size.height
                    })
                    .toFile(path)
                    .then(() => resolve(path));
            });
        } else {
            this.bigFilePath = this.bigFilePath || new Promise<string>(resolve => {
                const path = join(output, this.big);
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
    private readonly imgCache: { [id: string]: GalleryImage };
    private readonly init: Promise<any>;

    constructor() {
        this.dir = join(__dirname, "..", "gallery");
        this.cache = {};
        this.imgCache = {};
        this.init = new Promise<any>((resolve, reject) => {
            rimraf(output, error => {
                if (error) {
                    reject(error);
                    return;
                }
                mkdir(output, { recursive: true }, resolve);
            });
        });
    }

    getImage(id: string): Promise<Buffer> {
        const img = this.imgCache[id];
        return !img ? null : img.serve(id);
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

                                const galleryImg = new GalleryImage(sharpImg, meta, folder, size);
                                this.imgCache[galleryImg.big] = galleryImg;
                                this.imgCache[galleryImg.thumb] = galleryImg;

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
