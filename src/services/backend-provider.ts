import {createServer, Server} from "http";
import {Server as SocketServer} from "socket.io";
import cors from "cors";
import express_, {Express} from "express";
import {inject, singleton} from "tsyringe";
import bodyParser from 'body-parser';
import {Configuration} from './configuration';
import {DI_CONTAINER, IDependencyContainer} from '../common-types';
import {OpenApi} from './open-api';
import {JobManager} from './job-manager';
import {Fixtures} from './fixtures';

const express = express_;

@singleton()
export class BackendProvider {

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

    get express(): Express {
        if (!this.expressApp) {
            this.expressApp = express();
            this.expressApp.set("trust proxy", true);
            this.expressApp.use(cors());
            this.expressApp.use(bodyParser.json({
                limit: this.config.resolve("jsonLimit")
            }));
            this.expressApp.get("/api-docs", (req, res) => {
                this.openApi = this.openApi || this.container.get(OpenApi);
                res.header("Content-Type", "application/json")
                    .status(200)
                    .end(this.openApi.apiDocsStr);
            })
        }
        return this.expressApp;
    }

    get server(): Server {
        this.httpServer = this.httpServer || createServer(this.express);
        return this.httpServer;
    }

    protected ioServer: SocketServer;
    protected httpServer: Server;
    protected expressApp: Express;
    protected openApi: OpenApi;

    constructor(readonly config: Configuration,
                @inject(DI_CONTAINER) protected container: IDependencyContainer) {
    }

    async quickStart(): Promise<string> {
        const port = this.config.resolve("appPort");
        const isWorker = this.config.resolve("isWorker");
        if (isWorker || this.config.resolve("startWorker")) {
            await this.container.resolve(JobManager).startProcessing();
            if (isWorker) {
                return;
            }
        }
        if (this.config.resolve("fixtures")) {
            const fixtures = this.container.resolve(Fixtures);
            await fixtures.load();
        }
        return new Promise(resolve => {
            this.server.listen(port, () => resolve(`Service listening on port ${port}!`));
        });
    }
}
