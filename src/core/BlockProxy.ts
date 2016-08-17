/// <reference path="../breezeflow.ts" />
module BreezeFlow {
    const BlockProxy = {
        get: function (block: Block, field: string): any {
            let prop = block._props[field];
            if (prop) {
                return prop._value;
            }
            return null;
        },

        set: function (block: Block, field: string, value: any): void {
            let prop = block.getProp(field);
            prop.updateValue(value);
        }
    };
}