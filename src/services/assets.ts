import {inject, injectable, Lifecycle, scoped} from "tsyringe";
import {Readable} from "stream";
import {ObjectId} from "bson";
import {Collection} from "mongodb";
import {FilterQuery} from "mongoose";
import axios from "axios";

import {bufferToStream, copyStream, fileTypeFromBuffer, streamToBuffer} from "../utils";
import {
    ASSET_DRIVER_FACTORIES,
    ASSET_MAIN_DRIVER,
    ASSET_MISSING_DRIVER,
    AssetDriverFactoryMap,
    DI_CONTAINER,
    IAsset,
    IAssetDriver,
    IAssetMeta,
    IDependencyContainer,
    IFileType
} from "../common-types";
import {MongoConnector} from "./mongo-connector";
import {AssetProcessor} from "./asset-processor";
import {Asset} from "./entities/asset";
import {TempAsset} from "./entities/temp-asset";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class Assets {

    protected readonly collection: Collection<Partial<IAsset>>;
    protected readonly driverMap: Map<string, IAssetDriver>;
    readonly drivers: ReadonlyArray<string>;

    constructor(readonly connector: MongoConnector,
                readonly assetProcessor: AssetProcessor,
                @inject(DI_CONTAINER) protected readonly container: IDependencyContainer,
                @inject(ASSET_MAIN_DRIVER) protected readonly mainDriver: string,
                @inject(ASSET_MISSING_DRIVER) protected readonly missingDriver: string,
                @inject(ASSET_DRIVER_FACTORIES) protected readonly driverFactoryMap: AssetDriverFactoryMap) {
        this.collection = connector.database?.collection("assets.metadata");
        this.driverMap = new Map();
        this.drivers = Object.keys(driverFactoryMap);
    }

    getDriver(name: string): IAssetDriver {
        if (!name) {
            throw new Error(`No name provider for asset driver!`);
        }
        if (!this.driverMap.has(name)) {
            const factory = this.driverFactoryMap[name];
            if (!factory) {
                throw new Error(`No asset driver factory found with name: '${name}'!`);
            }
            this.driverMap.set(name, factory(this.container));
        }
        return this.driverMap.get(name);
    }

    async write(stream: Readable, contentType: string = null, metadata: IAssetMeta = null): Promise<IAsset> {
        const uploadStream = copyStream(stream);
        const buffer = await streamToBuffer(stream);
        let fileType = {ext: "", mime: contentType} as IFileType;
        try {
            fileType = await fileTypeFromBuffer(buffer);
        } catch (e) {
            if (!fileType.mime) {
                throw new Error(`Can't determine mime type: ${e}`);
            }
            console.log(`Can't determine mime type`, e);
        }
        metadata = metadata || {};
        return this.upload(uploadStream, fileType, metadata);
    }

    async writeBuffer(buffer: Buffer, metadata: IAssetMeta = null, contentType: string = null): Promise<IAsset> {
        let fileType = {ext: "", mime: contentType} as IFileType;
        try {
            fileType = await fileTypeFromBuffer(buffer);
        } catch (e) {
            if (!fileType.mime) {
                throw `Can't determine mime type`;
            }
            console.log(`Can't determine mime type`, e);
        }
        metadata = metadata || {};
        buffer = await this.assetProcessor.process(buffer, metadata, fileType);
        return this.upload(bufferToStream(buffer), fileType, metadata);
    }

    async writeUrl(url: string, metadata: IAssetMeta = null): Promise<IAsset> {
        metadata = metadata || {};
        metadata.filename = metadata.filename || url;
        metadata.url = url;
        metadata.uploadTime = new Date().getTime();
        const oneWeek = 1000 * 3600 * 24 * 7;
        const asset = await this.find({"metadata.url": url, "metadata.uploadTime": {$gt: metadata.uploadTime - oneWeek}});
        if (asset) return asset;
        const buffer = (await axios({ url, responseType: "arraybuffer" })).data as Buffer;
        return this.writeBuffer(buffer, metadata);
    }

    async download(url: string, contentType: string = null): Promise<IAsset> {
        let buffer = (await axios({ url, responseType: "arraybuffer" })).data as Buffer;
        let fileType = {ext: "", mime: contentType} as IFileType;
        try {
            fileType = await fileTypeFromBuffer(buffer);
        } catch (e) {
            if (!fileType.mime) {
                throw `Can't determine mime type`;
            }
            console.log(`Can't determine mime type`, e);
        }
        const metadata: IAssetMeta = {
            filename: url,
            extension: (fileType.ext || "").trim()
        };
        buffer = await this.assetProcessor.process(buffer, metadata, fileType);
        return new TempAsset(buffer, url, fileType.mime, metadata);
    }

    async read(id: string | ObjectId): Promise<IAsset> {
        return !id ? null : this.find({_id: new ObjectId(id)});
    }

    async find(where: FilterQuery<IAsset>): Promise<IAsset> {
        const data = await this.collection.findOne(where);
        return !data ? null : new Asset(data._id, data, this.collection, this.getDriver(data.driverId || this.missingDriver));
    }

    async findMany(where: FilterQuery<IAsset>): Promise<ReadonlyArray<IAsset>> {
        const cursor = this.collection.find(where);
        const items = await cursor.toArray() || [];
        const result: IAsset[] = [];
        for (let item of items) {
            if (!item) continue;
            result.push(new Asset(item._id, item, this.collection, this.getDriver(item.driverId || this.missingDriver)));
        }
        return result;
    }

    async deleteMany(where: FilterQuery<IAsset>): Promise<ReadonlyArray<string>> {
        const assets = await this.findMany(where);
        return Promise.all(assets.map(a => a.unlink()));
    }

    async unlink(id: string): Promise<any> {
        const asset = await this.read(id);
        if (!asset) return null;
        return asset.unlink();
    }

    protected async upload(stream: Readable, fileType: IFileType, metadata: IAssetMeta): Promise<IAsset> {
        const contentType = fileType.mime.trim();
        metadata = Object.assign({
            downloadCount: 0,
            firstDownload: null,
            lastDownload: null
        }, metadata || {});
        metadata.filename = metadata.filename || new ObjectId().toHexString();
        metadata.extension = (fileType.ext || "").trim();
        return new Promise<IAsset>(((resolve, reject) => {
            const driverId = this.mainDriver;
            const driver = this.getDriver(driverId);
            const uploaderStream = driver.openUploadStream(metadata.filename, {
                chunkSizeBytes: 1048576,
                contentType: fileType.mime,
                extension: fileType.ext,
                metadata,
            });
            stream.pipe(uploaderStream)
                .on("error", error => {
                    reject(error.message || error);
                })
                .on("finish", () => {
                    const asset = new Asset(uploaderStream.id as ObjectId, {
                        streamId: uploaderStream.id,
                        filename: metadata.filename,
                        contentType,
                        metadata,
                        driverId
                    }, this.collection, driver);
                    asset.save().then(() => {
                        resolve(asset);
                    }, error => {
                        reject(error.message || error);
                    });
                });
        }));
    }
}
