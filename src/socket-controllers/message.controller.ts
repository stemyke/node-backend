import {ConnectedSocket, OnConnect, OnDisconnect, SocketController,} from "socket-controllers";

@SocketController()
export class MessageController {

    @OnConnect()
    connection(@ConnectedSocket() socket: any) {
        console.log("client connected");
    }

    @OnDisconnect()
    disconnect(@ConnectedSocket() socket: any) {
        console.log("client disconnected");
    }
}
