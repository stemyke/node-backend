import {Injectable} from "injection-js";
import cacheman_mongo from "cacheman-mongodb";
import {MongoConnector} from "./mongo-connector";

const CachemanMongo = cacheman_mongo;

@Injectable()
export class Cache {

    protected cacheManMongo: typeof CachemanMongo;

    constructor(readonly connector: MongoConnector) {

    }

    protected prepare(): void {
        if (this.cacheManMongo instanceof CachemanMongo) return;
        if (!this.connector.database) {
            throw new Error(`You can't use cache without mongo connection!`);
        }
        this.cacheManMongo = new CachemanMongo(
            this.connector.database,
            {compression: true, collection: "cache"}
        );
    }

    set(key: string, value: any, ttl?: number): Promise<any> {
        this.prepare();
        return new Promise<any>((resolve, reject) => {
            this.cacheManMongo.set(key, value, ttl, (err, value) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(value);
            });
        });
    }

    get(key: string): Promise<any> {
        this.prepare();
        return new Promise<any>((resolve, reject) => {
            this.cacheManMongo.get(key, (err, value) => {
                if (err || value === null) {
                    reject(err || `Cache probably doesn't exists with key: ${key}`);
                    return;
                }
                resolve(value);
            });
        });
    }

    delete(key: string): Promise<any> {
        this.prepare();
        return new Promise<any>((resolve, reject) => {
            this.cacheManMongo.del(key, err => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}
