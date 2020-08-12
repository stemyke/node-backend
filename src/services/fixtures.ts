import {Inject, Injectable} from "injection-js";
import {FIXTURE, IFixture} from "../common-types";

@Injectable()
export class Fixtures {

    constructor(@Inject(FIXTURE) protected fixtures: IFixture[]) {}

    async load() {
        for (let fixture of this.fixtures) {
            await fixture.load();
        }
    }
}
