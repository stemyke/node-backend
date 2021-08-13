import {injectable, Lifecycle, scoped} from "tsyringe";
import {Cache, ICacheItem} from "./cache";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class MemoryCache {

    protected readonly cacheMap: Map<string, ICacheItem>;

    constructor(protected readonly cache: Cache) {
        this.cacheMap = new Map<string, ICacheItem>();
    }

    async set(key: string, value: any, ttl?: number, expirationTimestamp: number = null, tags: any = {}): Promise<any> {
        const now = Math.round(new Date().getTime() / 1000);
        const expTimestamp = Math.min(isNaN(ttl) ? Number.MAX_SAFE_INTEGER : ttl, 3600);
        this.cacheMap.set(key, {
            _id: key,
            data: value,
            expirationTimestamp: expTimestamp,
            expiresAt: now + expTimestamp,
        });
        return this.cache.set(key, value, ttl, expirationTimestamp, tags);
    }

    async get(key: string): Promise<any> {
        let item = this.cacheMap.get(key);
        const now = Math.round(new Date().getTime() / 1000);
        let expTimestamp = 3600;
        if (item && item.expiresAt && item.expiresAt < now) {
            expTimestamp = item.expirationTimestamp;
            item = null;
        }
        if (!item) {
            const value = await this.cache.get(key);
            this.cacheMap.set(key, {
                _id: key,
                data: value,
                expirationTimestamp: expTimestamp,
                expiresAt: now + expTimestamp,
            });
            return value;
        }
        return item.data;
    }

    async getOrSet(key: string, valueCb: () => Promise<any>, ttl?: number, expirationTimestamp: number = null, tags: any = {}): Promise<any> {
        try {
            return await this.get(key);
        } catch (e) {
            return await this.set(key, await valueCb(), ttl, expirationTimestamp, tags);
        }
    }

    async delete(key: string): Promise<any> {
        this.cacheMap.delete(key);
        await this.cacheMap.delete(key);
    }
}
