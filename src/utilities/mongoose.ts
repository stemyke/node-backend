import {Document, FilterQuery, Model, PipelineStage, Query, Schema} from "mongoose";
import mongoose from "mongoose";
import {getValue as getMongoValue, setValue as setMongoValue} from "mongoose/lib/utils";
import {DocumentType, ReturnModelType} from "@typegoose/typegoose";
import {Action, BadRequestError, createParamDecorator, HttpError} from "routing-controllers";
import {InjectionToken} from "tsyringe";
import {
    IMatchField,
    InferGeneric,
    IPaginationBase,
    IPaginationParams,
    IProjectOptions,
    IRequest,
    IUnwindOptions,
    Type
} from "../common-types";
import {diContainers, isArray, isFunction, isObject, isString, valueToPromise} from "../utils";

const pluginsKey = "typegoose:plugins";

interface IPluginWithOptions {
    mongoosePlugin: Function;
    options: any;
}

/**
 * A mongoose/typegoose plugin to inject services from the main di container to a schema as virtuals
 * @param schema
 * @param services
 */
export function injectServices(schema: Schema<any>, services?: { [prop: string]: InjectionToken<any> }): void {
    const serviceMap: { [prop: string]: any } = {};
    if (!isObject(services)) {
        throw new Error(`services object should be defined to inject services to schema!`)
    }
    Object.keys(services).forEach(prop => {
        schema
            .virtual(prop)
            .get(() => {
                const diContainer = diContainers.appContainer;
                serviceMap[prop] = serviceMap[prop] || (!diContainer ? {} : diContainer.resolve(services[prop]));
                return serviceMap[prop];
            });
    });
}

/**
 * Decorates a property to inject a service with the help of the injectServices mongoose/typegoose plugin
 * @param token optional InjectionToken to use
 * @return PropertyDecorator
 */
export function service(token?: InjectionToken<any>): PropertyDecorator {
    return (target: any, propertyKey: string): void => {
        const propertyType = Reflect.getOwnMetadata("design:type", target, propertyKey);
        const plugins = Array.from(Reflect.getMetadata(pluginsKey, target.constructor) ?? []) as IPluginWithOptions[];
        let plugin = plugins.find(t => t.mongoosePlugin === injectServices);
        if (!plugin) {
            plugin = { mongoosePlugin: injectServices, options: {} };
            plugins.push(plugin);
        }
        plugin.options = Object.assign(plugin.options || {}, {[propertyKey]: token ?? propertyType});
        Reflect.defineMetadata(pluginsKey, plugins, target.constructor);
    };
}

/**
 * Paginate using a typegoose model using a simple where query and pagination params
 * @param model Typegoose model
 * @param where Simple query to filter the results
 * @param params Pagination params
 */
export function paginate<T extends Type<any>, U = InferGeneric<T>>(model: ReturnModelType<T>, where: FilterQuery<DocumentType<U>>, params: IPaginationParams): Promise<IPaginationBase<DocumentType<U>>> {
    return model.countDocuments(where).then(count => {
        let query: Query<any, any> = model.find(where);
        if (isString(params.sort)) {
            query = query.sort(params.sort);
        }
        if (isArray(params.populate)) {
            params.populate.forEach(field => {
                query = query.populate(field);
            });
        }
        return (params.limit > 0 ? query.skip(params.page * params.limit).limit(params.limit) : query).then(items => {
            const meta = {total: count};
            return {count, items, meta};
        });
    });
}

export function lookupStages(from: string, localField: string, as: string = null, foreignField: string = "_id", shouldUnwind: boolean = true): [PipelineStage.Lookup, PipelineStage.Unwind] {
    as = as || localField.replace("Id", "");
    const stages: [PipelineStage.Lookup, PipelineStage.Unwind] = [
        {
            $lookup: {
                from,
                localField,
                foreignField,
                as
            }
        },
        {
            $unwind: {
                path: `$${as}`,
                preserveNullAndEmptyArrays: true
            }
        }
    ];
    if (!shouldUnwind) {
        stages.splice(1, 1);
    }
    return stages;
}

export function letsLookupStage(from: string, pipeline: Exclude<PipelineStage, PipelineStage.Merge | PipelineStage.Out | PipelineStage.Search>[], as: string = null, letFields: any = null): PipelineStage.Lookup {
    as = as || from;
    letFields = letFields || {id: "$_id"};
    return {
        $lookup: {
            from,
            let: letFields,
            pipeline,
            as
        }
    };
}

export function matchStage(match: FilterQuery<any>): PipelineStage.Match {
    return {$match: match};
}

export function matchField(field: string, filter: any, when: boolean): IMatchField {
    return {field, filter, when};
}

export function matchFieldStages(...fields: IMatchField[]): ReadonlyArray<PipelineStage.Match> {
    const match = {};
    fields.forEach(field => {
        if (field.when) {
            match[field.field] = field.filter;
        }
    });
    return Object.keys(match).length > 0 ? [matchStage(match)] : [];
}

export function projectStage(fields: IProjectOptions): PipelineStage.Project {
    return {$project: fields};
}

export function unwindStage(fieldOrOpts: string | IUnwindOptions): PipelineStage.Unwind {
    return {$unwind: fieldOrOpts};
}

export function hydratePopulated<T extends Document>(modelType: Model<T>, json: any): T {
    let object = modelType.hydrate(json);

    for (const [path, obj] of Object.entries(modelType.schema.obj)) {
        let {ref, type} = obj as any;
        if (Array.isArray(type) && type.length > 0) {
            ref = type[0].ref;
        }
        if (!ref) continue;
        const value = getMongoValue(path, json);
        const hydrateVal = val => {
            if (val == null || val instanceof mongoose.Types.ObjectId) return val;
            return hydratePopulated(mongoose.model(ref) as any, val);
        };
        if (Array.isArray(value)) {
            setMongoValue(path, value.map(hydrateVal), object);
            continue;
        }
        setMongoValue(path, hydrateVal(value), object);
    }

    return object;

}

export async function paginateAggregations<T extends Type<any>, U = InferGeneric<T>>(model: ReturnModelType<T>, aggregations: PipelineStage[], params: IPaginationParams, metaProjection: any = {}): Promise<IPaginationBase<DocumentType<U>>> {
    const sortField = !isString(params.sort) || !params.sort ? null : (params.sort.startsWith("-") ? params.sort.substr(1) : params.sort);
    const sortAggregation: PipelineStage.Sort[] = !sortField ? [] : [{
        $sort: {[sortField]: sortField == params.sort ? 1 : -1}
    }];
    const result = await model.aggregate([
        ...aggregations,
        ...sortAggregation,
        {
            $group: {
                _id: "results",
                result: {$push: "$$CURRENT"}
            }
        },
        {
            $project: {
                _id: 0,
                items: params.limit > 0 ? {$slice: ["$result", params.page * params.limit, params.limit]} : "$result",
                count: {$size: "$result"},
                meta: {
                    total: {$size: "$result"},
                    ...metaProjection
                }
            }
        }
    ]);
    const pagination = result[0] as IPaginationBase<DocumentType<U>>;
    if (!pagination) {
        return {items: [], count: 0, meta: {total: 0}};
    }
    pagination.items = pagination.items.map(i => hydratePopulated(model, i) as any);
    return pagination;
}

export function ResolveEntity<T extends Type<any>, U = InferGeneric<T>>(model: ReturnModelType<T>, extraCheck?: (query: Query<DocumentType<U>, any>, action: Action) => Promise<DocumentType<U>>): ParameterDecorator {
    const modelName = model.modelName;
    const paramName = modelName.toLowerCase();
    return createParamDecorator({
        required: false,
        value: async action => {
            const req = action.request as IRequest;
            const token = req.header(`x-${paramName}-token`);
            const id = req.params[`${paramName}Id`] as string;
            if (!id && !token) {
                throw new BadRequestError(`${modelName} id or token should be defined!`);
            }
            const query = !token
                ? model.findById(id)
                : model.findOne({token} as any);
            let doc: Document = null;
            if (isFunction(extraCheck)) {
                try {
                    doc = await valueToPromise(extraCheck(query, action));
                } catch (e) {
                    throw new BadRequestError(`${modelName} check error: ${e.message || e}`);
                }
            } else {
                doc = await query;
            }
            if (!doc) {
                throw new HttpError(404, !token
                    ? `${modelName} could not be found with id: ${id}`
                    : `${modelName} could not be found with token: ${token}`);
            }
            action.request[paramName] = doc;
            return doc;
        }
    });
}
