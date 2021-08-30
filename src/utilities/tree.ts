import {IDependencyContainer, ITree} from "../common-types";
import {isString} from "../utils";

export class Tree implements ITree {

    protected map: Map<string, Tree>;

    constructor(protected container: IDependencyContainer, readonly path: string) {
        this.map = new Map<string, Tree>();
    }

    resolveService(): any {
        return this.container.resolve(this.path);
    }

    resolveLeaves(): Map<string, ITree> {
        let map: Map<string, ITree>;
        try {
            const parentTree = this.container.parent.tree.resolvePath(this.path);
            map = parentTree.resolveLeaves();
        } catch (e) {
            map = new Map<string, ITree>();
        }
        const visitor = (treeMap: Map<string, Tree>, path: string) => {
            treeMap.forEach((tree, key) => {
                const subKey = !path ? key : `${path}.${key}`;
                if (tree.map.size == 0) {
                    map.set(subKey, tree);
                    return;
                }
                visitor(tree.map, subKey);
            });
        };
        visitor(this.map, "");
        return map;
    }

    resolveServices(): Map<string, any> {
        const map = new Map<string, any>();
        this.resolveLeaves().forEach((leaf, key) => {
            map.set(key, leaf.resolveService());
        });
        return map;
    }

    resolveAncestor(path: string): ITree {
        if (!isString(path) || path.length == 0) {
            return this;
        }
        const pathParts = path.split(".");
        let tree: Tree = this;
        let previousTree: Tree = this;
        for (let part of pathParts) {
            tree = tree.map.get(part);
            if (!tree) {
                if (previousTree == this) {
                    throw new Error(`Ancestor '${path}' not found in current tree: '${this.path}'`);
                }
                return previousTree;
            }
            previousTree = tree;
        }
        return previousTree;
    }

    resolvePath(path: string, throwError: boolean = true): ITree {
        if (!isString(path) || path.length == 0) {
            return this;
        }
        const pathParts = path.split(".");
        let tree: Tree = this;
        for (let part of pathParts) {
            tree = tree.map.get(part);
            if (!tree) {
                try {
                    const parentTree = this.container.parent.tree.resolvePath(this.path);
                    return parentTree.resolvePath(path);
                } catch (e) {
                    if (throwError) {
                        throw new Error(`Path '${path}' not found in current tree: '${this.path}'`);
                    }
                    return new Tree(this.container, !this.path ? path : `${this.path}.${path}`);
                }
            }
        }
        return tree;
    }

    addPath(path: string): this {
        if (!isString(path) || path.length == 0) {
            return this;
        }
        const pathParts = path.split(".");
        let tree: Tree = this;
        path = this.path;
        for (let part of pathParts) {
            if (!tree.map.has(part)) {
                tree.map.set(part, new Tree(this.container, !path ? part : `${path}.${part}`))
            }
            tree = tree.map.get(part);
            path = tree.path;
        }
        return this;
    }
}
