import {injectable} from "tsyringe";
import {IFixture} from '../common-types';
import {MongoConnector} from '../services/mongo-connector';

@injectable()
export class TtlFixture implements IFixture {

    constructor(readonly connector: MongoConnector) {

    }

    async load(): Promise<any> {
        const db = this.connector.database;
        if (!db) return null;
        const expires = {expireAfterSeconds: 3600 * 24};
        await db.collection("progresses").createIndex({updatedAt: 1}, expires);
        await db.collection("lazyassets").createIndex({updatedAt: 1}, expires);
    }
}
