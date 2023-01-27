import {injectAll, singleton} from "tsyringe";
import {CommandsAddon, ICommandMap, ISuggestionMap} from "@stemy/terminal-commands-addon";
import {ITerminal, ITerminalCommand, TERMINAL_COMMAND} from "../common-types";
import {Logger} from "./logger";
import {Configuration} from "./configuration";
import {camelCaseToDash, colorize, ConsoleColor} from "../utils";

@singleton()
export class TerminalManager {
    protected servicePassword: string;
    protected suggestions: ISuggestionMap;
    protected commands: ICommandMap;
    protected loggedOutCommands: string[];
    protected loggedInCommands: string[];

    constructor(protected logger: Logger,
                protected config: Configuration,
                @injectAll(TERMINAL_COMMAND) commands: ITerminalCommand[]) {
        this.servicePassword = config.resolve("servicePassword");
        this.suggestions = {
            login: async (args) => {
                if (args.length > 2) {
                    return null;
                }
                const input = `${args.at(1).label}`;
                return (!input) ? [] : [{
                    id: input,
                    label: input,
                    masked: true
                }];
            },
            ...commands.reduce((acc, command) => {
                command.name = camelCaseToDash(command.name || command.constructor.name || "");
                if (!command.name || !command.suggest) return acc;
                acc[command.name] = async (a, t) => command.suggest(a, t);
                return acc;
            }, {})
        };
        this.commands = commands.reduce((acc, command) => {
            if (!command.name) return acc;
            acc[command.name] = async (a, t) => command.execute(a, t);
            return acc;
        }, {});
        this.loggedOutCommands = ["login", "clear"];
        this.loggedInCommands = Object.keys(this.commands);
        this.loggedInCommands.push("logout");
        console.log(`Current service password is: ${colorize(this.servicePassword, ConsoleColor.FgGreen)}`);
    }

    loadAddons(terminal: ITerminal): void {
        let loggedIn = false;
        const addon = new CommandsAddon({
            commands: {
                login: async (args, terminal) => {
                    if (args.at(1).label === this.servicePassword) {
                        loggedIn = true;
                        terminal.writeln("Logged in as admin");
                    } else {
                        throw new Error("Invalid login");
                    }
                },
                logout: async (args, terminal) => {
                    loggedIn = false;
                    terminal.writeln("Logged out");
                },
                ...this.commands
            },
            suggestCommands: async () => {
                if (loggedIn) {
                    return this.loggedInCommands;
                }
                return this.loggedOutCommands;
            },
            suggestions: this.suggestions
        });
        terminal.loadAddon(addon);
    }
}
