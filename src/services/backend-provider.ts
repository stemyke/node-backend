import {createServer, Server} from "http";
import express_, {Express} from "express";
import {singleton} from "tsyringe";
import {Server as SocketServer} from "socket.io";

const express = express_;

@singleton()
export class BackendProvider {

    readonly express: Express;
    readonly server: Server;

    get io(): SocketServer {
        this.ioServer = this.ioServer || new SocketServer(this.server, {
            path: "/socket",
            cors: {
                credentials: true,
                exposedHeaders: ["content-disposition"],
                origin: (origin, callback) => {
                    callback(null, true);
                }
            }
        });
        return this.ioServer;
    }

    protected ioServer: SocketServer;

    constructor() {
        this.express = express();
        this.express.set("trust proxy", true);
        this.server = createServer(this.express);
    }
}
