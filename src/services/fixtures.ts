import {injectable, injectAll, Lifecycle, scoped} from "tsyringe";
import {FIXTURE, IFixture, IFixtureOutput} from "../common-types";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class Fixtures {

    constructor(@injectAll(FIXTURE) protected fixtures: IFixture[]) {

    }

    async load(output?: IFixtureOutput): Promise<any> {
        if (!this.fixtures) return;
        output = output || {
            write: console.log,
            writeln: t => console.log(t + "\n")
        };
        for (let fixture of this.fixtures) {
            await fixture.load(output);
        }
    }
}
