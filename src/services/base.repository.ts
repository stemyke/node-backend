import { Document, Model } from "mongoose";
import { ExtractProps } from "ts-mongoose";
import { ObjectId } from "bson";

export interface IPagination {
    count: number
    items: any[];
}

export class BaseRepository<Doc extends Document, Props extends ExtractProps<any>> {

    constructor(private type: Model<any>) {

    }

    countDocuments(props?: Partial<Props>): Promise<number> {
        return !props
            ? this.type.estimatedDocumentCount().then(t => t as number)
            : this.type.countDocuments(props).then(t => t as number);
    }

    create(props: Partial<Props>): Promise<Doc> {
        return !props
            ? Promise.reject('message.no-props.error')
            : this.type.create([props]).then(res => res[0] as Doc);
    }

    save(model: Doc): Promise<Doc> {
        return !model
            ? Promise.reject(`message.no-model.error`)
            : model.save().then(t => t as Props);
    }

    paginate(where: Partial<Props>, page: number, limit: number, sort: string = null, filter: string = null): Promise<IPagination> {
        const filterParams: any[] = !filter ? [] : JSON.parse(filter);
        const filterQuery: any = Object.assign({}, where);
        if (Array.isArray(filterParams)) {
            filterParams.forEach((filter) => {
                filterQuery[filter.field] = { "$regex": filter.search, "$options": "i" };
            });
        }
        return this.type.countDocuments(filterQuery).then(count => {
            let query = this.type.find(filterQuery).sort(sort);
            return (limit > 0 ? query.skip(page * limit).limit(limit) : query).then(items => {
                return { count, items };
            });
        });
    }

    find(where: Partial<Props>): Promise<Doc[]> {
        return this.type.find(where).then(t => t as Doc[]);
    }

    findOne(where: Partial<Props>): Promise<Doc> {
        return this.type.findOne(where).then(t => t as Doc);
    }

    findById(id: string | ObjectId): Promise<Doc> {
        return this.type.findById(id).then(t => t as Doc);
    }

    delete(id: string): Promise<any> {
        return this.type.deleteOne({ _id: new ObjectId(id) }).then(() => {
            return {
                _id: id
            };
        });
    }

    toJSON(model: Doc): any {
        return model.toJSON();
    }
}
