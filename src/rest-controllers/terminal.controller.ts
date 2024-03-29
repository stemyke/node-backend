import {injectable} from "tsyringe";
import {Controller, Get, Header} from "routing-controllers";
import {Configuration} from "../services/configuration";
import styles from "./terminal-styles";

@injectable()
@Controller()
export class TerminalController {

    protected serviceName: string;

    protected serviceUrl: string;

    constructor(readonly config: Configuration) {
        this.serviceName = config.resolve("serviceName");
        this.serviceUrl = config.resolve("serviceUrl");
    }

    @Get("/terminal")
    @Header("Content-Type", "text/html")
    terminal() {
        return this.generateClient("terminal");
    }

    @Get("/console")
    @Header("Content-Type", "text/html")
    console() {
        return this.generateClient("console");
    }

    protected generateClient(alias: string): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${this.serviceName} ${alias}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.1.0/css/xterm.min.css"/>
            <script type="text/javascript" src="${this.serviceUrl}/socket/socket.io.js"></script>
            <style>
                ${styles}
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
                            socket.emit("terminal-upload", {
                                id: data.id,
                                label: file.name,
                                content: reader.result,
                                accept: data.accept
                            });
                        };
                        reader.onerror = function () {
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
                    terminal.writeln("Welcome to ${this.serviceName} service's ${alias}!");
                    socket.emit("terminal-init");
                });
                socket.on("disconnect", function () {
                    clear();
                    terminal.writeln("Disconnected from ${this.serviceName} service's ${alias}.");
                });
            </script>
        </body>
        </html>
        `;
    }
}
