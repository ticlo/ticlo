module bzflow {

    export class BlockRoot extends Block {
        constructor() {
            super(null, null);

            this._root = this;
            this._prop = new BlockChild(this, '');
        }
    }
}