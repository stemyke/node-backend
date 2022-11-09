import {singleton} from "tsyringe";
import {Db, GridFSBucket} from "mongodb";
import {connect, Connection} from "mongoose";
import {Configuration} from "./configuration";

@singleton()
export class MongoConnector {

    get connection(): Connection {
        return this.conn;
    }

    get database(): Db {
        return this.db;
    }

    get bucket(): GridFSBucket {
        return this.fsBucket;
    }

    protected conn: Connection;
    protected db: Db;
    protected fsBucket: GridFSBucket;

    constructor(readonly configuration: Configuration) {
        this.conn = null;
        this.db = null;
        this.fsBucket = null;
    }

    async connect(): Promise<Db> {
        if (this.db) return this.db;
        this.conn = (await connect(this.configuration.resolve("mongoUri") as string, {
            dbName: this.configuration.resolve("mongoDb"),
            user: this.configuration.resolve("mongoUser"),
            pass: this.configuration.resolve("mongoPassword")
        })).connection;
        this.db = this.conn.db as any;
        this.fsBucket = new GridFSBucket(this.db, {bucketName: "assets"});
    }
}
