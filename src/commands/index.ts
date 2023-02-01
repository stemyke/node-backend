import {ClearCommand} from "./clear-command";
import {ITerminalCommand, Type} from "../common-types";
import {FixturesCommand} from "./fixtures-command";

export const commands: Type<ITerminalCommand>[] = [
    ClearCommand,
    FixturesCommand
];
