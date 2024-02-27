import {inject, injectable, Lifecycle, scoped} from "tsyringe";
import {DI_CONTAINER, FIXTURE, IDependencyContainer, IFixture, IFixtureOutput} from "../common-types";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class Fixtures {

    protected fixtures: IFixture[];

    constructor(@inject(DI_CONTAINER) protected container: IDependencyContainer) {
    }

    protected init(output?: IFixtureOutput): IFixture[] {
        try {
            return this.container.resolveAll(FIXTURE);
        } catch (e) {
            output.writeln(e.message);
            return [];
        }
    }

    async load(output?: IFixtureOutput): Promise<any> {
        output = output || {
            write: console.log,
            writeln: t => console.log(t + "\n")
        };
        this.fixtures = this.fixtures || this.init(output);
        output.write(`Loading fixtures: ${this.fixtures.length} items`);
        for (let fixture of this.fixtures) {
            await fixture.load(output);
        }
    }
}
