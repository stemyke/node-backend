import {singleton} from "tsyringe";
import {Db} from "mongodb";
import mongoose from "mongoose";
import {Configuration} from "./configuration";

@singleton()
export class MongoConnector {

    get connection(): mongoose.Connection {
        return this.conn;
    }

    get database(): Db {
        return this.db;
    }

    protected conn: mongoose.Connection;
    protected db: Db;

    constructor(readonly configuration: Configuration) {
        this.conn = null;
        this.db = null;
    }

    async connect(): Promise<Db> {
        if (this.db) return this.db;
        this.conn = (await mongoose.connect(this.configuration.resolve("mongoUri") as string, {
            dbName: this.configuration.resolve("mongoDb"),
            user: this.configuration.resolve("mongoUser"),
            pass: this.configuration.resolve("mongoPassword")
        })).connection;
        this.db = this.conn.db as any;
    }
}
