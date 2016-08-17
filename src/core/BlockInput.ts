/// <reference path="../breezeflow.ts" />
module BreezeFlow {

    export class BlockInput extends BlockProperty {
        _isSysInput: boolean;

        constructor(block: Block, name: string) {
            super(block, name);
            this._isSysInput = (name.charCodeAt(1) == 62); // >>
        }

        updateValue(val: any): any {
            if (this._value === val) {
                return false;
            }
            this._value = val;
            this.dispatch();
            this._block.inputChanged(this, val);
            return true;
        };
    }
}
