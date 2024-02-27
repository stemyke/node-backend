import {injectable, injectAll, Lifecycle, scoped} from "tsyringe";
import {DI_CONTAINER, FIXTURE, IDependencyContainer, IFixture, IFixtureOutput} from "../common-types";

@injectable()
@scoped(Lifecycle.ContainerScoped)
export class Fixtures {

    protected fixtures: IFixture[];

    constructor(@injectAll(DI_CONTAINER) protected container: IDependencyContainer) {
    }

    protected init(): IFixture[] {
        try {
            return this.container.resolveAll(FIXTURE);
        } catch (e) {
            return [];
        }
    }

    async load(output?: IFixtureOutput): Promise<any> {
        this.fixtures = this.fixtures || this.init();
        output = output || {
            write: console.log,
            writeln: t => console.log(t + "\n")
        };
        for (let fixture of this.fixtures) {
            await fixture.load(output);
        }
    }
}
