import {singleton} from "tsyringe";
import {ConnectedSocket, MessageBody, OnMessage, SocketController} from "socket-controllers";

import {IClientSocket, ITerminalFile} from "../common-types";
import {TerminalManager} from "../services/terminal-manager";
import {SocketTerminal} from "./socket-terminal";

@singleton()
@SocketController()
export class TerminalController {
    protected terminals: {[id: string]: SocketTerminal};

    constructor(protected manager: TerminalManager) {
        this.terminals = {};
    }

    @OnMessage("terminal-init")
    async terminalInit(@ConnectedSocket() client: IClientSocket) {
        const terminal = new SocketTerminal(client);
        this.manager.loadAddons(terminal);
        this.terminals[client.id] = terminal;
        client.on("disconnect", () => terminal.dispose());
    }

    @OnMessage("terminal-data")
    async terminalData(@ConnectedSocket() client: IClientSocket, @MessageBody() data: string) {
        const terminal = this.terminals[client.id];
        if (!terminal) return;
        terminal.input(data);
    }

    @OnMessage("terminal-upload")
    async terminalUpload(@ConnectedSocket() client: IClientSocket, @MessageBody() upload: ITerminalFile) {
        const terminal = this.terminals[client.id];
        if (!terminal || !upload) return;
        terminal.addFile(upload);
    }
}
