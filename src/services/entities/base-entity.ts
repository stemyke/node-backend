import {Collection} from "mongodb";
import {ObjectId} from "bson";

export class BaseEntity<T> {

    get id(): string {
        return this.oid.toHexString();
    }

    protected deleted: boolean;

    constructor(readonly oid: ObjectId,
                protected data: Partial<T>,
                protected collection: Collection<any>) {
    }

    save(): Promise<any> {
        return this.collection.updateOne({_id: this.oid}, {$set: this.toJSON()}, {upsert: true});
    }

    async load(): Promise<this> {
        const res = await this.collection.findOne({_id: this.oid});
        this.deleted = !res;
        this.data = res || {};
        return this;
    }

    toJSON(): any {
        const ret = Object.assign({}, this.data) as any;
        delete ret._id;
        ret.id = this.id;
        ret.updatedAt = new Date();
        ret.createdAt = ret.createdAt || ret.updatedAt;
        return ret;
    }
}
