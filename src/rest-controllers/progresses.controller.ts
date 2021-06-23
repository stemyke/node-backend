import {injectable} from "tsyringe";
import {Controller, Get, Param} from "routing-controllers";
import {Progresses} from "../services/progresses";
import {Configuration} from "../services/configuration";

@injectable()
@Controller("/progresses")
export class ProgressesController {

    protected connectionType: string;

    constructor(readonly progresses: Progresses, readonly config: Configuration) {
        const mainEndpoint = this.config.resolve("mainEndpoint");
        this.connectionType = !mainEndpoint ? "polling" : "socket";
    }

    @Get("/:id")
    async getProgress(@Param("id") id: string) {
        const progress = await this.progresses.get(id);
        if (!progress) return null;
        const json = progress.toJSON();
        json.connectionType = this.connectionType;
        return json;
    }
}
