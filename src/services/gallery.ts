import {Injectable} from "injection-js";
import sharp_ from "sharp";
import {access, constants, lstat, readdir, readFile, writeFile} from "fs";
import {join, dirname} from "path";
import {IGalleryImage, IGallerySize} from "../common-types";
import * as Buffer from "buffer";
import {Configuration} from "./configuration";
import {GalleryCache} from "./gallery-cache";
import {mkdirRecursive} from "../utils";

const sharp = sharp_;

@Injectable()
export class Gallery {

    private readonly dir: string;
    private readonly output: string;
    private readonly cache: { [folder: string]: Promise<IGalleryImage[]> };

    constructor(readonly config: Configuration, readonly galleryCache: GalleryCache) {
        this.cache = {};
        this.dir = this.config.resolve("galleryDir");
        this.output = join(this.config.resolve("cacheDir"), "gallery");
    }

    async getFolder(folder: string, size: IGallerySize = null): Promise<IGalleryImage[]> {
        this.cache[folder] = this.cache[folder] || new Promise<IGalleryImage[]>(resolve => {
            lstat(join(this.dir, folder), (err, stats) => {
                if (err || !stats.isDirectory()) {
                    resolve([]);
                    return;
                }
                this.readRecursive(folder, "", size).then(resolve, () => resolve([]));
            });
        });
        return this.cache[folder];
    }

    protected readRecursive(path: string, folder: string, size: IGallerySize): Promise<IGalleryImage[]> {
        return new Promise<IGalleryImage[]>(resolve => {
            readdir(join(this.dir, path), (err, files) => {
                if (err) {
                    resolve([]);
                    return;
                }
                const promises = files.map(file => {
                    return new Promise<IGalleryImage[]>(async resolve => {
                        const filePath = join(path, file);
                        const absoluteFilePath = join(this.dir, filePath);
                        lstat(absoluteFilePath, (err, stats) => {
                            if (err) {
                                resolve([]);
                                return;
                            }
                            if (stats.isDirectory()) {
                                this.readRecursive(filePath, join(folder, file), size).then(resolve);
                                return;
                            }
                            const sharpImg = sharp(absoluteFilePath);
                            sharpImg.rotate().metadata().then(() => {
                                const getResultPath = (isThumb) => {
                                    return join(this.output, filePath.replace(/.([a-z|A-Z]+)$/gi, function (ext) {
                                        const suffix = isThumb ? 'thumb' : 'big';
                                        return `-${suffix}${ext}`;
                                    }));
                                };
                                resolve([this.galleryCache.create(folder, size, {
                                    getOriginal: () => {
                                        return new Promise<Buffer>((res, rej) => {
                                            readFile(absoluteFilePath, (err, data) => {
                                                if (err) {
                                                    rej(err);
                                                    return;
                                                }
                                                res(data);
                                            });
                                        });
                                    },
                                    writeResult: (isThumb: boolean, buffer: Buffer) => {
                                        return new Promise<any>(async (res, rej) => {
                                            const resultPath = getResultPath(isThumb);
                                            await mkdirRecursive(dirname(resultPath));
                                            writeFile(resultPath, buffer, err => {
                                                if (err) {
                                                    rej(err);
                                                    return;
                                                }
                                                res();
                                            });
                                        });
                                    },
                                    hasResult: (isThumb: boolean) => {
                                        return new Promise<boolean>(res => {
                                            access(getResultPath(isThumb), constants.R_OK, err => {
                                                res(!err);
                                            });
                                        });
                                    },
                                    serveResult: (isThumb: boolean) => {
                                        return new Promise<Buffer>((res, rej) => {
                                            readFile(getResultPath(isThumb), (err, data) => {
                                                if (err) {
                                                    rej(err);
                                                    return;
                                                }
                                                res(data);
                                            });
                                        });
                                    }
                                })]);
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
