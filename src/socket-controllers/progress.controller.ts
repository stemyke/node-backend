import {inject, singleton} from "tsyringe";
import {ConnectedSocket, MessageBody, OnMessage, SocketController,} from "socket-controllers";
import {Server} from "socket.io";
import {IClientSocket, SOCKET_SERVER} from "../common-types";
import {broadcast} from "../utils";
import {Progresses} from "../services/progresses";

@singleton()
@SocketController()
export class ProgressController {

    constructor(readonly progresses: Progresses, @inject(SOCKET_SERVER) readonly socketServer: Server) {
    }

    @OnMessage("background-progress")
    async advanceProgress(@ConnectedSocket() client: IClientSocket, @MessageBody() progressId: string) {
        const progress = await this.progresses.get(progressId);
        if (!progress) return;
        const json = progress.toJSON();
        broadcast(this.socketServer, c => {
            if (c.interestedProgresses instanceof Set && c.interestedProgresses.has(progressId)) {
                client.emit("background-progress-changed", json);
            }
        });
        console.log(`progress changed: ${client.id}, data: ${JSON.stringify(json)}`);
    }

    @OnMessage("background-progress-interest")
    async setProgressInterest(@ConnectedSocket() client: IClientSocket, @MessageBody() progressId: string) {
        const progress = await this.progresses.get(progressId);
        if (!progress) return;
        const json = progress.toJSON();
        client.interestedProgresses = client.interestedProgresses || new Set<string>();
        if (client.interestedProgresses.has(progressId)) return;
        client.interestedProgresses.add(progressId);
        client.emit("background-progress-changed", json);
        console.log(`progress interest added: ${client.id}, data: ${JSON.stringify(json)}`);
    }
}
