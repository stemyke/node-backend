import {createServer, Server} from "http";
import express_, {Express} from "express";
import {injectable} from "tsyringe";
import socket_io, {Server as SocketServer} from "socket.io";

const express = express_;
const socketIO = socket_io;

@injectable()
export class BackendProvider {

    readonly express: Express;
    readonly server: Server;

    get io(): SocketServer {
        this.ioServer = this.ioServer || socketIO(this.server, {path: "/socket"});
        return this.ioServer;
    }

    protected ioServer: SocketServer;

    constructor() {
        this.express = express();
        this.server = createServer(this.express);
    }
}