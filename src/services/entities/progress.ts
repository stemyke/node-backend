import {ObjectId} from "bson";
import {Collection} from "mongodb";
import {IProgress} from "../../common-types";

export class Progress implements IProgress {

    get id(): string {
        return this.progressId.toHexString();
    }

    get current(): number {
        return this.mCurrent;
    }

    get max(): number {
        return this.mMax;
    }

    get message(): string {
        return this.mMessage;
    }

    get error(): string {
        return this.mError;
    }

    get percent(): number {
        return this.mMax > 0 ? Math.round(this.mCurrent / this.mMax * 100) : 0;
    }

    get remaining(): number {
        return this.mMax > 0 ? this.mMax - this.mCurrent : 0;
    }

    constructor(readonly progressId: ObjectId,
                protected mCurrent: number,
                protected mMax: number,
                protected mMessage: string,
                protected mError: string,
                protected client: SocketIOClient.Socket,
                protected collection: Collection) {
    }

    async createSubProgress(progressValue: number, max?: number, message?: string): Promise<IProgress> {
        if (max <= 0 && progressValue > 0) {
            await this.advance(progressValue);
        }
        if (message !== null) {
            this.mMessage = message;
            await this.save();
        }
        return new SubProgress(this, this.mCurrent, progressValue, Math.max(max, 1));
    }

    async setMax(max: number): Promise<any> {
        if (isNaN(max) || max <= 0) {
            throw "Max progress value must be bigger than zero";
        }
        this.mMax = max;
        await this.save();
    }

    async setError(error: string): Promise<any> {
        this.mError = error;
        await this.save();
    }

    async advance(value: number = 1): Promise<any> {
        if (isNaN(value) || value <= 0) {
            throw "Advance value must be bigger than zero";
        }
        this.mCurrent = Math.min(this.mMax, this.mCurrent + value);
        await this.save();
        if (!this.client) return;
        this.client.emit("background-progress", this.id);
    }

    toJSON(): any {
        return {
            id: this.id,
            current: this.current,
            max: this.max,
            message: this.message,
            error: this.error
        };
    }

    save(): Promise<any> {
        return this.collection.updateOne({_id: this.progressId}, {$set: this.toJSON()});
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

    get remaining(): number {
        return this.max - this.currentValue;
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
