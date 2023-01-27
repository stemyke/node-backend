import {injectable} from "tsyringe";
import {Controller, Get, Header} from "routing-controllers";
import {Configuration} from "../services/configuration";

@injectable()
@Controller("/console")
export class TerminalController {

    protected serviceName: string;

    protected serviceUrl: string;

    constructor(readonly config: Configuration) {
        this.serviceName = config.resolve("serviceName");
        this.serviceUrl = config.resolve("serviceUrl");
    }

    @Get()
    @Header("Content-Type", "text/html")
    terminal() {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${this.serviceName} console</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.1.0/css/xterm.min.css"/>
            <script type="text/javascript" src="${this.serviceUrl}/socket/socket.io.js"></script>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    background: #1e1e1e;
                }
                body * {
                    box-sizing: border-box;
                }
                #terminal {
                    margin: 40px;
                    background: black;
                    border: 1px solid #dedede;
                    border-radius: 5px;
                    overflow: hidden;
                }
                #terminal .xterm {
                    margin: 10px;
                    height: calc(100vh - 120px);
                    border-radius: 5px;
                }
                #terminal .xterm-viewport::-webkit-scrollbar {
                    width: 0.4em;
                    background-color: #222;
                }
                #terminal .xterm-viewport::-webkit-scrollbar-thumb {
                    background-color: #555;
                }
            </style>
        </head>
        <body>
            <div id="terminal"></div>
            <script type="module">
                // Import terminal modules
                import xterm from 'https://cdn.jsdelivr.net/npm/xterm@5.1.0/+esm';
                import xtermFit from 'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.7.0/+esm';
                // Initialize variables
                var terminal = new xterm.Terminal();
                var fitAddon = new xtermFit.FitAddon();
                var socket = io("${this.serviceUrl}", {path: "/socket"});
                var clear = function () {
                    terminal.clear();
                    terminal.reset();
                    // Prev line
                    terminal.write("\u001B[F");
                }
                // Initialize terminal
                terminal.loadAddon(fitAddon);
                terminal.open(document.getElementById('terminal'));
                terminal.onData(function (data) {
                    socket.emit("terminal-data", data.charCodeAt(0) === 127 ? "\b" : data);
                });
                // Socket listeners
                socket.on("terminal-data", function (data) {
                    if (data === "\x1bc") {
                        clear();
                        return;
                    }
                    terminal.write(data);
                });
                socket.on("terminal-upload", function (data) {
                    var input = document.createElement("input");
                    input.type = "file";
                    input.accept = data.accept;
                    input.onchange = function () {
                        var file = input.files[0];
                        var reader = new FileReader();
                        reader.onload = function () {
                            console.log(reader.result);
                            socket.emit("terminal-upload", {
                                id: data.id,
                                label: file.name,
                                content: reader.result,
                                accept: data.accept
                            });
                        };
                        reader.onerror = function () {
                            console.error(reader.error);
                            socket.emit("terminal-upload", {
                                id: data.id,
                                label: file.name,
                                error: reader.error,
                                accept: data.accept
                            });
                        };
                        reader.readAsDataURL(file);
                    };
                    input.click();
                });
                socket.on("terminal-download", function (data) {
                    var link = document.createElement("a");
                    link.href = data.content;
                    link.download = data.filename;
                    link.click();
                });
                socket.on("connect", function () {
                    clear();
                    terminal.writeln("Welcome to ${this.serviceName} service's console!");
                    socket.emit("terminal-init");
                });
                socket.on("disconnect", function () {
                    clear();
                    terminal.writeln("Disconnected from ${this.serviceName} service's console.");
                });
            </script>
        </body>
        </html>
        `;
    }
}
