import {Collection} from "mongodb";
import {ObjectId} from "bson";

export class BaseEntity<T> {

    get id(): string {
        return this.mId.toHexString();
    }

    protected deleted: boolean;

    constructor(readonly mId: ObjectId,
                protected data: Partial<T>,
                protected collection: Collection) {
    }

    save(): Promise<any> {
        return this.collection.updateOne({_id: this.mId}, {$set: this.toJSON()});
    }

    async load(): Promise<this> {
        const res = await this.collection.findOne({_id: this.mId});
        this.deleted = !res;
        this.data = res || {};
        return this;
    }

    toJSON(): any {
        const ret = Object.assign({}, this.data) as any;
        delete ret._id;
        ret.id = this.id;
        return ret;
    }
}
