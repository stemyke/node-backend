import {injectable, injectAll, Lifecycle, scoped} from "tsyringe";
import {FIXTURE, IFixture} from "../common-types";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class Fixtures {

    constructor(@injectAll(FIXTURE) protected fixtures: IFixture[]) {

    }

    async load() {
        if (!this.fixtures) return;

        for (let fixture of this.fixtures) {
            await fixture.load();
        }
    }
}
