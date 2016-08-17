/// <reference path="../breezeflow.ts" />
module BreezeFlow {
    const _types: {[key: string]: Type} = {};

    let _typesFinalized = false;

    export class Types {
        static add(name: string, Class: LogicType) {
            let type = _types[name];

            if (!type) {
                type = new Type(name);
                _types[name] = type;
            }
            type.update(Class);
        };

        static listen(name: string, block: Block): RefListRef<Block> {
            let type = _types[name];

            if (!type) {
                type = new Type(name);
                _types[name] = type;
            }
            return type.addValue(block);
        };
    }
}