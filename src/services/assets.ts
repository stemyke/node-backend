import {Injectable} from "injection-js";
import {Duplex, Readable} from "stream";
import {ObjectId} from "bson";
import {connection} from "mongoose";
import {createModel} from "mongoose-gridfs";
import * as sharp_ from "sharp";

const sharp = sharp_;

interface IAsset {
    write: (opts: any, stream: Readable, cb: Function) => void;
    unlink: (opts: any, cb: Function) => void;
    read: (opts: any) => Readable;
}

@Injectable()
export class Assets {

    private asset: IAsset;

    constructor() {
        this.asset = createModel({
            modelName: "Asset",
            connection
        });
    }

    async write(stream: Readable, contentType: string, filename: string = null): Promise<string> {
        filename = filename || new ObjectId().toHexString();
        return new Promise<string>(((resolve, reject) => {
            this.asset.write({filename, contentType}, stream, (error, file) => {
                if (error) {
                    return reject(error.message || error);
                }
                resolve(file._id.toHexString());
            });
        }));
    }

    async writeBuffer(buffer: Buffer, contentType: string, filename: string = null): Promise<string> {
        if ((contentType || "").startsWith("image")) {
            buffer = await sharp(buffer).rotate().toBuffer();
        }
        const stream = new Duplex();
        stream.push(buffer);
        stream.push(null);
        return this.write(stream, contentType, filename);
    }

    read(id: string): Readable {
        return this.asset.read({_id: new ObjectId(id)});
    }

    unlink(id: string): Promise<any> {
        return new Promise<string>(((resolve, reject) => {
            this.asset.unlink({_id: new ObjectId(id)}, (error) => {
                if (error) {
                    return reject(error.message || error);
                }
                resolve();
            });
        }));
    }
}
