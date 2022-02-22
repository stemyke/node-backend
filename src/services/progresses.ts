import {injectable, singleton} from "tsyringe";
import socket_io_client from "socket.io-client"
import {ObjectId} from "bson";
import {FilterQuery} from "mongoose";
import {IProgress} from "../common-types";
import {promiseTimeout} from "../utils";
import {Configuration} from "./configuration";
import {Progress} from "./entities/progress";
import {MongoConnector} from "./mongo-connector";
import {Collection} from "mongodb";

const socketIOClient = socket_io_client;

@injectable()
@singleton()
export class Progresses {

    protected client: SocketIOClient.Socket;
    readonly collection: Collection;

    constructor(readonly connector: MongoConnector, readonly config: Configuration) {
        const mainEndpoint = this.config.resolve("mainEndpoint");
        this.client = !mainEndpoint ? null : socketIOClient(mainEndpoint, {path: "/socket"});
        this.collection = connector.database.collection("progresses");
    }

    async waitToFinish(id: string): Promise<IProgress> {
        let isFinished = false;
        let progress: IProgress = null;
        while (!isFinished) {
            progress = await this.get(id);
            if (!progress) {
                throw `Progress does not exists with id: ${id}`;
            }
            if (progress.error) {
                throw progress.error;
            }
            isFinished = progress.percent == 100;
            if (!isFinished) {
                await promiseTimeout(50);
            }
        }
        return progress;
    }

    async get(id: string): Promise<IProgress> {
        return !id ? null : this.find({_id: new ObjectId(id)});
    }

    async find(where: FilterQuery<IProgress>): Promise<IProgress> {
        const data = await this.collection.findOne(where);
        return !data ? null : new Progress(
            data._id, data, this.collection, this.client
        );
    }

    async create(max: number = 100): Promise<IProgress> {
        if (isNaN(max) || max <= 0) {
            throw "Max progress value must be bigger than zero";
        }
        const data = {
            current: 0,
            max: max,
            message: "",
            error: "",
            canceled: false
        };
        const res = await this.collection.insertOne(data);
        return new Progress(
            res.insertedId, data, this.collection, this.client
        );
    }

    async remove(id: string): Promise<any> {
        await this.collection.deleteOne({_id: new ObjectId(id)});
        return id;
    }
}
