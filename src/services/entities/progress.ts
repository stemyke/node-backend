import {ObjectId} from "bson";
import {Collection} from "mongodb";
import {IMessageBridge, IProgress} from "../../common-types";
import {BaseEntity} from "./base-entity";

export class Progress extends BaseEntity<IProgress> implements IProgress {

    protected messageBridge: IMessageBridge;

    get current(): number {
        return this.data.current;
    }

    get max(): number {
        return this.data.max;
    }

    get message(): string {
        return this.data.message;
    }

    get error(): string {
        return this.data.error;
    }

    get canceled(): boolean {
        return this.data.canceled;
    }

    get percent(): number {
        return this.max > 0 ? Math.round(this.current / this.max * 100) : 0;
    }

    get remaining(): number {
        return this.max > 0 ? this.max - this.current : 0;
    }

    constructor(id: ObjectId,
                data: Partial<IProgress>,
                collection: Collection) {
        super(id, data, collection);
    }

    setMessageBridge(messageBridge: IMessageBridge): this {
        this.messageBridge = messageBridge || this.messageBridge;
        return this;
    }

    async createSubProgress(progressValue: number, max?: number, message?: string): Promise<IProgress> {
        if (max <= 0 && progressValue > 0) {
            await this.advance(progressValue);
        }
        if (message !== null) {
            this.data.message = message;
            await this.save();
        }
        return new SubProgress(this, this.current, progressValue, Math.max(max, 1));
    }

    async setMax(max: number): Promise<any> {
        if (isNaN(max) || max <= 0) {
            throw "Max progress value must be bigger than zero";
        }
        this.data.max = max;
        await this.save();
    }

    async setMessage(message: string): Promise<any> {
        this.data.message = message;
        await this.save();
    }

    async setError(error: string): Promise<any> {
        this.data.error = error;
        await this.save();
    }

    async advance(value: number = 1): Promise<any> {
        if (isNaN(value) || value <= 0) {
            throw "Advance value must be bigger than zero";
        }
        await this.load();
        if (this.deleted || this.canceled) return null;
        this.data.current = Math.min(this.max, this.current + value);
        await this.save();
    }

    async cancel(): Promise<any> {
        this.data.canceled = true;
        await this.save();
    }

    save(): Promise<any> {
        if (this.messageBridge) {
            this.messageBridge.sendMessage(`progress-changed`, this.toJSON());
        }
        return super.save();
    }
}

export class SubProgress implements IProgress {

    get id(): string {
        return this.parent.id;
    }

    get current(): number {
        return this.mCurrent;
    }

    get max(): number {
        return this.mMax;
    }

    get message(): string {
        return this.parent.message;
    }

    get error(): string {
        return this.parent.error;
    }

    get percent(): number {
        return this.parent.percent;
    }

    get remaining(): number {
        return this.max - this.mCurrent;
    }

    get canceled(): boolean {
        return !this.parent || this.parent.canceled;
    }

    protected mCurrent: number;

    constructor(protected parent: IProgress, protected progressFrom: number, protected progressValue: number, protected mMax: number = 100) {
        if (progressFrom < 0) {
            throw "Progress from must be bigger than or zero";
        }
        if (progressValue <= 0) {
            throw "Progress value must be bigger than zero";
        }
        this.mCurrent = 0;
    }

    setMessageBridge(messageBridge: IMessageBridge): this {
        if (!this.parent) return this;
        this.parent.setMessageBridge(messageBridge);
        return this;
    }

    async createSubProgress(progressValue: number, max?: number, message?: string): Promise<IProgress> {
        if (max <= 0 && progressValue > 0) {
            await this.advance(progressValue);
        }
        if (message !== null) {
            await this.setMessage(message);
        }
        return new SubProgress(this, this.current, progressValue, Math.max(max, 1));
    }

    async setMax(max: number): Promise<any> {
        if (isNaN(max) || max <= 0) {
            throw "Max progress value must be bigger than zero";
        }
        this.mMax = max;
        await this.save();
    }

    async setMessage(message: string): Promise<any> {
        if (!this.parent) return null;
        await this.parent.setMessage(message);
    }

    async setError(error: string): Promise<any> {
        if (!this.parent) return null;
        await this.parent.setError(error);
    }

    async advance(value: number = 1): Promise<any> {
        if (isNaN(value) || value <= 0) {
            throw "Advance value must be bigger than zero";
        }
        this.mCurrent = Math.min(this.max, this.mCurrent + value);
        await this.save();
    }

    async cancel(): Promise<any> {
        if (!this.parent) return null;
        await this.parent.cancel();
    }

    async save(): Promise<any> {
        const ratio = this.max > 0 ? this.mCurrent / this.max : 0;
        const newProgress = this.progressFrom + Math.round(this.progressValue * ratio);
        const current = this.parent.current;
        if (newProgress <= current) return null;
        await this.parent.advance(newProgress)
    }

    async load(): Promise<any> {
        return null;
    }

    toJSON(): any {
        return this.parent.toJSON();
    }
}
