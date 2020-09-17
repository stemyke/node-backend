import {Injectable} from "injection-js";
import cacheman_mongo from "cacheman-mongodb";

const CachemanMongo = cacheman_mongo;

@Injectable()
export class Cache {

    private readonly cacheman: typeof CachemanMongo;

    constructor() {
        this.cacheman = CachemanMongo["appInstance"];
        if (!this.cacheman) {
            throw new Error(`You can't use cache without mongo connection!`);
        }
    }

    set(key: string, value: any, ttl?: number): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.cacheman.set(key, value, ttl, (err, value) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(value);
            });
        });
    }

    get(key: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.cacheman.get(key, (err, value) => {
                if (err || value === null) {
                    reject(err || `Cache probably doesn't exists with key: ${key}`);
                    return;
                }
                resolve(value);
            });
        });
    }

    delete(key: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.cacheman.del(key, err => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}
