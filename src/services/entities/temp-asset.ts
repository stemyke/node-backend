import {Readable} from "stream";
import {ObjectId} from "bson";
import {IAsset, IAssetImageParams, IAssetMeta} from "../../common-types";
import {bufferToStream} from "../../utils";
import {Asset} from "./asset";

export class TempAsset implements IAsset {

    readonly id: string;

    get stream(): Readable {
        return bufferToStream(this.buffer);
    }

    constructor(protected buffer: Buffer, readonly filename: string, readonly contentType: string, readonly metadata: IAssetMeta) {
        this.id = new ObjectId().toHexString();
    }

    async unlink(): Promise<string> {
        throw new Error(`Temp asset '${this.id}' can not be removed!`);
    }

    async getBuffer(): Promise<Buffer> {
        return this.buffer;
    }

    async download(metadata?: IAssetMeta): Promise<Readable> {
        return this.stream;
    }

    downloadImage(params?: IAssetImageParams, metadata?: IAssetMeta): Promise<Readable> {
        Object.assign(this.metadata, metadata || {});
        return Asset.toImage(this.stream, this.metadata, params);
    }

    getImage(params?: IAssetImageParams): Promise<Readable> {
        return this.downloadImage(params);
    }

    async save(): Promise<any> {
        return this;
    }

    async load(): Promise<this> {
        return this;
    }

    toJSON(): any {
        return {
            id: this.id,
            filename: this.filename,
            contentType: this.contentType,
            metadata: this.metadata
        };
    }
}
