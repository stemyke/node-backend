import {Inject, Injectable, Optional} from "injection-js";
import {FIXTURE, IFixture} from "../common-types";

@Injectable()
export class Fixtures {

    constructor(@Optional() @Inject(FIXTURE) protected fixtures: IFixture[] = []) {}

    async load() {
        if (!this.fixtures) return;

        for (let fixture of this.fixtures) {
            await fixture.load();
        }
    }
}
