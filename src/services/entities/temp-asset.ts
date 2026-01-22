import {Readable} from "stream";
import {ObjectId} from "bson";
import {IAsset, IAssetImageParams, IAssetMeta} from "../../common-types";
import {bufferToStream, toImage} from "../../utils";

export class TempAsset implements IAsset {

    get id(): string {
        return this.oid.toHexString();
    }

    get streamId(): ObjectId {
        return this.oid;
    }

    get driverId(): string {
        return "temp";
    }

    get stream(): Readable {
        return bufferToStream(this.buffer);
    }

    protected readonly oid: ObjectId;

    constructor(protected buffer: Buffer, readonly filename: string, readonly contentType: string, readonly metadata: IAssetMeta) {
        this.oid = new ObjectId();
    }

    async unlink(): Promise<string> {
        throw new Error(`Temp asset '${this.id}' can not be removed!`);
    }

    async setMeta(meta: Partial<IAssetMeta>): Promise<any> {
        Object.assign(this.metadata, meta || {});
    }

    async getBuffer(): Promise<Buffer> {
        return this.buffer;
    }

    async move(): Promise<IAsset> {
        throw new Error(`Temp asset '${this.id}' can not be moved!`);
    }

    async download(metadata?: IAssetMeta): Promise<Readable> {
        return this.stream;
    }

    downloadImage(params?: IAssetImageParams, metadata?: IAssetMeta): Promise<Readable> {
        Object.assign(this.metadata, metadata || {});
        return toImage(this.stream, params, this.metadata);
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
