import {injectable, Lifecycle, scoped} from "tsyringe";
import {Collection} from "mongodb";
import {MongoConnector} from "./mongo-connector";
import {Configuration} from "./configuration";
import {CacheProcessor} from "./cache-processor";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class Cache {

    protected collection: Collection;

    constructor(readonly connector: MongoConnector, protected config: Configuration, protected cacheProcessor: CacheProcessor) {

    }

    protected async prepare(): Promise<any> {
        if (this.collection) return;
        if (!this.connector.database) {
            throw new Error(`You can't use cache without mongo connection!`);
        }
        this.collection = this.connector.database.collection(this.config.resolve("cacheCollection"));
        await this.collection.createIndex(
            {expireAt: 1},
            {expireAfterSeconds: 0}
        );
    }

    async set(key: string, value: any, ttl?: number, expirationTimeStamp: number = null): Promise<any> {
        await this.prepare();
        const item: any = {
            _id: key,
            data: await this.cacheProcessor.serialize(value),
            expirationTimeStamp
        };
        if (ttl) {
            const now = Math.round(new Date().getTime() / 1000);
            item.expiresAt = now + ttl;
        }
        await this.collection.updateOne({_id: key}, {$set: item}, {upsert: true});
    }

    async get(key: string): Promise<any> {
        await this.prepare();
        let item = await this.collection.findOne({_id: key});
        const now = Math.round(new Date().getTime() / 1000);
        if (item && item.expiresAt && item.expiresAt < now) {
            item = null;
        }
        if (!item) {
            throw new Error(`Cache probably doesn't exists with key: ${key}`);
        }
        return await this.cacheProcessor.deserialize(item.data);
    }

    async delete(key: string): Promise<any> {
        await this.prepare();
        await this.collection.deleteOne({_id: key});
    }
}
