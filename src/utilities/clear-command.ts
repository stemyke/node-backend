import {injectable, Lifecycle, scoped} from "tsyringe";
import {ITerminal, ITerminalCommand} from "../common-types";
import {AnsiCodes, ICommandArgs} from "@stemy/terminal-commands-addon";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class ClearCommand implements ITerminalCommand {

    readonly name = "clear";

    async execute(args: ICommandArgs, terminal: ITerminal): Promise<any> {
        terminal.write(AnsiCodes.clear);
    }
}
