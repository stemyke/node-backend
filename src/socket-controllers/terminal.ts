import {BehaviorSubject, Subject} from "rxjs";
import {first, map, timeout} from "rxjs/operators";
import {IDisposable, ISuggestion, ITerminalAddon} from "@stemy/terminal-commands-addon";
import {IClientSocket, ITerminal, ITerminalFile} from "../common-types";

export class Terminal implements ITerminal {
    protected addons: ITerminalAddon[];
    protected files$: BehaviorSubject<ITerminalFile[]>;
    protected input$: Subject<string>;

    constructor(protected client: IClientSocket) {
        this.addons = [];
        this.files$ = new BehaviorSubject([]);
        this.input$ = new Subject();
    }

    onData(cb: (data: string) => any): IDisposable {
        const sub = this.input$.pipe(map(v => {
            if (v === "\b") {
                return "\x7f";
            }
            return v;
        })).subscribe(cb);
        return {
            dispose: () => sub.unsubscribe()
        };
    }

    write(data: string): void {
        this.client.emit("terminal-data", data);
    }

    writeln(data: string): void {
        this.write(data + "\n");
    }

    loadAddon(addon: ITerminalAddon) {
        addon.activate(this);
        this.addons.push(addon);
    }

    dispose() {
        this.input$.complete();
        this.client = null;
        this.addons.forEach(a => a.dispose());
    }

    async suggestFiles(accept: string): Promise<ITerminalFile[]> {
        const rand = Math.round(Math.random() * 1000);
        const id = `${Date.now()}-${rand}`;
        const files = this.files$.value as ISuggestion[];
        return files.filter(f => f.accept === accept).concat([
            {
                id,
                label: "...",
                onAccept: async () => {
                    this.client.emit("terminal-upload", {
                        id,
                        accept
                    });
                    const file = await this.files$
                        .pipe(first(v => v.some(f => f.id === id)))
                        .pipe(timeout(60000))
                        .pipe(map(v => v.find(f => f.id === id)))
                        .toPromise();
                    if (file.error) {
                        this.files$.next(this.files$.value.filter(f => f.id !== id));
                        throw new Error(file.error);
                    }
                    return file;
                },
                showAlways: true,
                accept: accept,
            }
        ]);
    }

    addFile(upload: ITerminalFile) {
        if (upload.content) {
            upload.buffer = Buffer.from(upload.content, "base64");
        }
        this.files$.next(this.files$.value.concat(upload));
    }

    input(data: string) {
        this.input$.next(data);
    }
}
