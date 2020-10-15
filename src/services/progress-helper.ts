import {Injectable} from "injection-js";
import socket_io_client from "socket.io-client"
import {IProgress} from "../common-types";
import {ProgressDoc} from "../models/progress";
import {Configuration} from "./configuration";

const socketIOClient = socket_io_client;

@Injectable()
export class ProgressHelper {

    protected client: SocketIOClient.Socket;

    constructor(readonly config: Configuration) {
        const mainEndpoint = this.config.resolve("mainEndpoint");
        this.client = !mainEndpoint ? null : socketIOClient(mainEndpoint, {path: "/socket"});
    }

    getPercent(progress: ProgressDoc): number {
        return progress.max > 0 ? Math.round(progress.current / progress.max * 100) : 0;
    }

    async createSubProgress(progress: ProgressDoc, progressValue: number, max?: number, message?: string): Promise<IProgress> {
        if (max <= 0 && progressValue > 0) {
            await progress.advance(progressValue);
        }
        if (message !== null) {
            progress.message = message;
            await progress.save();
        }
        return new SubProgress(progress, progress.current, progressValue, Math.max(max, 1));
    }

    async setMax(progress: ProgressDoc, max: number): Promise<any> {
        if (isNaN(max) || max <= 0) {
            throw "Max progress value must be bigger than zero";
        }
        progress.max = max;
        await progress.save();
    }

    async setError(progress: ProgressDoc, error: string): Promise<any> {
        progress.error = error;
        await progress.save();
    }

    async advance(progress: ProgressDoc, value: number = 1): Promise<any> {
        if (isNaN(value) || value <= 0) {
            throw "Advance value must be bigger than zero";
        }
        progress.current = Math.min(progress.max, progress.current + value);
        await progress.save();
        if (!this.client) return;
        this.client.emit("background-progress", progress.id);
    }
}

export class SubProgress implements IProgress {

    get id(): string {
        return this.parent.id;
    }

    get message(): string {
        return this.parent.message;
    }

    set message(value: string) {
        this.parent.message = value;
    }

    get error(): string {
        return this.parent.error;
    }

    set error(value: string) {
        this.parent.error = value;
    }

    get percent(): number {
        return this.parent.percent;
    }

    get current(): number {
        return this.currentValue;
    }

    private currentValue: number;

    constructor(private parent: IProgress, private progressFrom: number, private progressValue: number, private max: number = 100) {
        if (progressFrom < 0) {
            throw "Progress from must be bigger than or zero";
        }
        if (progressValue <= 0) {
            throw "Progress value must be bigger than zero";
        }
        this.currentValue = 0;
    }

    async createSubProgress(progressValue: number, max?: number, message?: string): Promise<IProgress> {
        if (max <= 0 && progressValue > 0) {
            await this.advance(progressValue);
        }
        if (message !== null) {
            this.message = message;
            await this.parent.save();
        }
        return new SubProgress(this, this.current, progressValue, Math.max(max, 1));
    }

    async setMax(max: number): Promise<any> {
        if (isNaN(max) || max <= 0) {
            throw "Max progress value must be bigger than zero";
        }
        this.max = max;
        await this.save();
    }

    async setError(error: string): Promise<any> {
        this.error = error || null;
        await this.save();
    }

    async advance(value: number = 1): Promise<any> {
        if (isNaN(value) || value <= 0) {
            throw "Advance value must be bigger than zero";
        }
        this.currentValue = Math.min(this.max, this.currentValue + value);
        await this.save();
    }

    async save(): Promise<any> {
        const ratio = this.max > 0 ? this.currentValue / this.max : 0;
        const newProgress = this.progressFrom + Math.round(this.progressValue * ratio);
        const current = this.parent.current;
        if (newProgress <= current) return null;
        await this.parent.advance(newProgress)
    }

    toJSON(): any {
        return this.parent.toJSON();
    }
}
