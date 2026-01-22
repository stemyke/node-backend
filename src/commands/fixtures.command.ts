import {injectable, Lifecycle, scoped} from "tsyringe";
import {ICommandArgs} from "@stemy/terminal-commands-addon";

import {IFixtureOutput, ITerminal, ITerminalCommand} from "../common-types";
import {Fixtures} from "../services/fixtures";
import {colorize, ConsoleColor} from "../utils";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class FixturesCommand implements ITerminalCommand {

    readonly name = "fixtures";

    constructor(protected fixtures: Fixtures) {
    }

    async execute(args: ICommandArgs, terminal: ITerminal): Promise<any> {
        const output: IFixtureOutput = {
            write: text => terminal.writeln(text),
            writeln: text => terminal.writeln(text)
        };
        await this.fixtures.load(output);
        terminal.writeln(colorize(`Fixtures loaded`, ConsoleColor.FgGreen));
    }
}
