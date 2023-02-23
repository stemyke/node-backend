import {existsSync} from "fs";
import {resolve} from "path";
import {static as serveStatic} from "express";
import {EXPRESS, IDependencyContainer} from "./common-types";
import {EndpointProvider} from "./services/endpoint-provider";
import {getDirName} from "./utils";

export async function setupStatic(rootFolder: string, container: IDependencyContainer): Promise<any> {

    const browserFolder = resolve(rootFolder || getDirName(), `public_html`);
    const app = container.get(EXPRESS);
    const ep = container.get(EndpointProvider);

    console.log(browserFolder, existsSync(browserFolder));

    if (existsSync(browserFolder)) {
        console.log(`public_html exists. setting up static files serving...`);
        app.use(serveStatic(browserFolder, {
            maxAge: "1y"
        }));
    } else {
        console.log(`public_html does not exist on path: "${browserFolder}"`);
    }

    await ep.configure(app);
}
