import {injectable} from "tsyringe";
import {GridFSBucket} from 'mongodb';
import {GridFSBucket as BucketImpl} from 'mongodb/lib/gridfs';

import {IAsset, IAssetDriver, IAssetUploadOpts} from '../../common-types';
import {MongoConnector} from "../mongo-connector";

@injectable()
export class AssetGridDriver implements IAssetDriver {

    protected bucket: GridFSBucket;

    constructor(connector: MongoConnector) {
        this.bucket = new BucketImpl(connector.database, {bucketName: 'assets'});
    }

    openUploadStream(filename: string, opts?: IAssetUploadOpts) {
        return this.bucket.openUploadStream(filename, opts);
    }

    openDownloadStream(asset: IAsset) {
        return this.bucket.openDownloadStream(asset.streamId);
    }

    delete(asset: IAsset) {
        return this.bucket.delete(asset.streamId);
    }
}
