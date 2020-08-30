import {Injector} from "injection-js";
import {Document, FilterQuery, Model} from "mongoose";
import {ObjectId} from "bson";

export interface IPagination {
    count: number
    items: any[];
}

export class BaseRepository<Doc extends Document> {

    private readonly injectServices: (docs: Doc[]) => Doc[];

    constructor(protected injector: Injector, protected readonly type: Model<any>) {
        const injectedServiceTypes = Reflect.getMetadata("injected-services", type) || {};
        const injectedServices = Object.keys(injectedServiceTypes).map(prop => ({
            prop,
            service: injector.get(injectedServiceTypes[prop])
        }));
        this.injectServices = (docs: Doc[]) => {
            docs.forEach(doc => {
                if (!doc) return;
                injectedServices.forEach(s => {
                    doc[s.prop] = s.service;
                });
            });
            return docs;
        };
    }

    countDocuments(props?: FilterQuery<Doc>): Promise<number> {
        return !props
            ? this.type.estimatedDocumentCount().then(t => t as number)
            : this.type.countDocuments(props).then(t => t as number);
    }

    create(props: Partial<Doc>): Promise<Doc> {
        return !props
            ? Promise.reject("message.no-props.error")
            : this.type.create([props]).then(docs => {
                this.injectServices(docs);
                return docs[0] as Doc;
            });
    }

    paginate(where: FilterQuery<Doc>, page: number, limit: number, sort: string = null): Promise<IPagination> {
        return this.type.countDocuments(where).then(count => {
            let query = this.type.find(where).sort(sort);
            return (limit > 0 ? query.skip(page * limit).limit(limit) : query).then(items => {
                this.injectServices(items);
                return { count, items };
            });
        });
    }

    async find(where: FilterQuery<Doc>): Promise<Doc[]> {
        return this.type.find(where).then(this.injectServices);
    }

    async findOne(where: FilterQuery<Doc>): Promise<Doc> {
        return this.type.findOne(where).then(doc => {
            this.injectServices([doc]);
            return doc;
        });
    }

    async findById(id: string | ObjectId): Promise<Doc> {
        return this.type.findById(id).then(doc => {
            this.injectServices([doc]);
            return doc;
        });
    }

    delete(id: string): Promise<any> {
        return this.type.deleteOne({ _id: new ObjectId(id) }).then(() => {
            return {
                _id: id
            };
        });
    }
}
