import {createReadStream, createWriteStream, mkdirSync, writeFileSync} from 'fs';
import {join} from 'path';
import {inject, injectable} from 'tsyringe';
import {rm} from 'fs/promises';
import {ObjectId} from 'bson';

import {ASSET_LOCAL_DIR, IAsset, IAssetDriver, IAssetUploadOpts, IAssetUploadStream} from '../../common-types';

@injectable()
export class AssetLocalDriver implements IAssetDriver {

    constructor(@inject(ASSET_LOCAL_DIR) protected dir: string) {
    }

    openUploadStream(filename: string, opts: IAssetUploadOpts) {
        const id = new ObjectId();
        const dir = `${this.dir}/${id.toHexString()}`;
        mkdirSync(dir, { recursive: true });
        const stream = createWriteStream(this.getPath(id, filename, opts.extension)) as IAssetUploadStream;
        stream.done = false;
        stream.on('finish', () => {
            stream.id = id;
            stream.done = true;
            writeFileSync(`${dir}/metadata.json`, JSON.stringify(opts?.metadata || {}));
        });
        return stream;
    }

    openDownloadStream(asset: IAsset) {
        return createReadStream(
            this.getPath(asset.streamId, asset.filename, asset.metadata.extension),
            {autoClose: true, emitClose: true}
        );
    }

    delete(asset: IAsset) {
        return rm(
            this.getPath(asset.streamId, asset.filename, asset.metadata.extension),
            { recursive: true, force: true }
        );
    }

    protected getPath(id: ObjectId, name: string, ext: string): string {
        return join(this.dir, id.toHexString(), `${name}.${ext}`);
    }
}
