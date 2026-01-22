import {injectable, Lifecycle, scoped} from "tsyringe";
import {ICommandArgs, IProgressBar, ISuggestion} from "@stemy/terminal-commands-addon";

import {ITerminal, ITerminalCommand} from "../common-types";
import {Assets} from "../services/assets";
import {colorize, ConsoleColor, promiseTimeout, regexEscape} from "../utils";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class MoveAssetsCommand implements ITerminalCommand {

    readonly name = "move-assets";

    constructor(protected assets: Assets) {
    }

    async execute(args: ICommandArgs, terminal: ITerminal, progress: IProgressBar): Promise<any> {
        await promiseTimeout(1000);
        const from = `${args.at(1).id}`;
        const to = `${args.at(2).id}`;
        const assets = await this.assets.findMany(from === this.assets.missingDriver ? {
            $or: [
                { driverId: from },
                { driverId: { "$exists": false } }
            ]
        } : {driverId: from});
        progress.setMax(assets.length)

        for (const asset of assets) {
            await asset.move(to);
            progress.advance();
        }

        terminal.writeln(colorize(`Assets successfully moved to: ${to}`, ConsoleColor.FgGreen));
    }

    async suggest?(args: ICommandArgs): Promise<Array<string | ISuggestion>> {
        if (args.length > 3) {
            return null;
        }
        // Replace regex special characters
        const prev = args.length === 3 ? args.at(1) : null;
        const id = regexEscape(args.search);
        const regex = new RegExp(id, "g");
        return this.assets.drivers.filter(d => d.match(regex) && (!prev || d !== prev.id));
    }
}
