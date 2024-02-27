import {ngPackagr} from "ng-packagr";

ngPackagr()
    .forProject('ng-package.json')
    .withTsConfig('tsconfig.lib.json')
    .build()
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
