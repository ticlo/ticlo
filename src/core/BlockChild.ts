/// <reference path="../breezeflow.ts" />
module BreezeFlow {
    export class BlockChild extends BlockProperty {
        constructor(block: Block, name: string) {
            super(block, name);
        }


        updateValue(val: any): any {
            if (!(val instanceof Block)) {
                val = null;
            }
            if (this._value === val) {
                return false;
            }
            if (this._saved && this._saved != val) {
                this._saved.destroy();
                this._saved = null;
            }
            this._value = val;
            this.dispatch();
            return true;
        };

        setValue(val: any): void {
            if (!(val instanceof Block)) {
                val = null;
            }
            if (this._bindingRef) {
                this._bindingRef.remove();
                this._bindingPath = null;
                this._bindingRef = null
            }
            if (this._saved != val) {
                if (this._saved) {
                    this._saved.destroy();
                }
                this._saved = val;
            }
            this.updateValue(val);
        };

        _load(val: {[key: string]: any}) {
            if (val != null && Object.getPrototypeOf(val) === Object.prototype) {
                let block = new Block(this._block._root, this);
                this._saved = block;
                this._value = block;
                block._load(val);
                this.dispatch();
            }
        };

    }
}