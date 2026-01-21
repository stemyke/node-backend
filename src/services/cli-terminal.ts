import * as readline from "readline";
import {IDisposable, ITerminalAddon} from "@stemy/terminal-commands-addon";
import {ITerminal} from "../common-types";

export class CliTerminal implements ITerminal {
    private callbacks: Set<(data: string) => any> = new Set();
    private stdin = process.stdin as NodeJS.ReadStream;

    constructor() {
        // Set stdin to raw mode to get character-by-character data
        if (this.stdin.isTTY) {
            this.stdin.setRawMode(true);
        }
        this.clearScreen();
        this.stdin.setEncoding('utf8');
        this.stdin.on('data', this.handleInput);
    }

    private clearScreen(): void {
        readline.cursorTo(process.stdout, 0, 0);
        readline.clearScreenDown(process.stdout);
    }

    private handleInput = (data: Buffer | string): void => {
        const input = data.toString();

        // Standard "Ctrl+C" exit handling
        if (input === '\u0003') {
            this.clearScreen();
            this.dispose();
        }

        this.callbacks.forEach((cb) => cb(input));
    };

    /**
     * Registers a listener for data input.
     * Returns an IDisposable to unregister the listener.
     */
    public onData(cb: (data: string) => any): IDisposable {
        this.callbacks.add(cb);
        return {
            dispose: () => this.callbacks.delete(cb),
        };
    }

    public write(data: string): void {
        process.stdout.write(data);
    }

    public writeln(data: string): void {
        process.stdout.write(data + '\n');
    }

    public loadAddon(addon: ITerminalAddon): void {
        addon.activate(this);
    }

    public dispose(): void {
        if (this.stdin.isTTY) {
            this.stdin.setRawMode(false);
        }
        this.stdin.removeListener('data', this.handleInput);
        this.stdin.pause();
        this.callbacks.clear();
        process.exit();
    }
}
