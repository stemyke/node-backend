import {injectable} from "tsyringe";
import {GridFSBucket, ObjectId} from 'mongodb';
import {GridFSBucket as BucketImpl} from 'mongodb/lib/gridfs';

import {IAssetDriver, IAssetUploadOpts} from '../../common-types';
import {MongoConnector} from "../mongo-connector";

@injectable()
export class AssetGridDriver implements IAssetDriver {
    readonly metaCollection: string;

    protected bucket: GridFSBucket;

    constructor(connector: MongoConnector) {
        this.bucket = new BucketImpl(connector.database, {bucketName: 'assets'});
        this.metaCollection = "assets.files";
    }

    openUploadStream(filename: string, opts?: IAssetUploadOpts) {
        return this.bucket.openUploadStream(filename, opts);
    }

    openDownloadStream(id: ObjectId) {
        return this.bucket.openDownloadStream(id);
    }

    delete(id: ObjectId) {
        return this.bucket.delete(id);
    }
}
