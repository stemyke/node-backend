import {ClearCommand} from "./clear.command";
import {ITerminalCommand, Type} from "../common-types";
import {FixturesCommand} from "./fixtures.command";
import {MoveAssetsCommand} from "./move-assets.command";

export const commands: Type<ITerminalCommand>[] = [
    ClearCommand,
    FixturesCommand,
    MoveAssetsCommand
];
