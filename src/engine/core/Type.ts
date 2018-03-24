module bzflow {

    export class Type {
        _Class: LogicType = null;
        _name: string;
        _blocks: RefList<Block>;
        _isStatic: boolean;
        _boundUpdateBlockLogic: (value: Block)=>void;

        constructor(name: string) {
            this._name = name;

            this._blocks = new RefList<Block>();
            this._blocks._owner = this;

            this._boundUpdateBlockLogic = Type.prototype._updateBlockLogic.bind(this);

            this._isStatic = !name.includes('::');
        }


        _updateBlockLogic(block: Block) {
            block.updateLogic(this._Class);
        };

        update(Class: LogicType) {
            this._Class = Class;
            this._blocks.forEach(this._boundUpdateBlockLogic);
        };

        addValue(block: Block): RefListRef<Block> {
            block.updateLogic(this._Class);
            if (this._isStatic && this._Class) {
                return null;
            } else {
                return this._blocks.addValue(block);
            }
        };
    }
}