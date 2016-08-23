module breezeflow {

    export class BlockProperty implements IDispatch {

        _block: Block;
        _name: string;
        _listeners: RefList<IListen> = null;
        _bindingPath: string = null;
        _pendingDispatch: boolean = false;

        _bindingRef: RefListRef<IListen> = null;

        _value: any = null;
        _saved: any = null;

        constructor(block: Block, name: string) {

            this._block = block;
            this._name = name;
        }

        updateValue(val: any): boolean {
            return false; // to be mixin
        }

        onDispatch(listener: IListen): void {
            // to be mixin
        }

        dispatch() {
            if (this._listeners) {
                this._listeners.forEach(this.onDispatch, this);
            }
            this._pendingDispatch = false;
        };

        listen(listener: IListen): RefListRef<IListen> {
            if (this._listeners == null) {
                this._listeners = new RefList<IListen>(BlockProperty.prototype.unListen.bind(this));
            }
            let r = this._listeners.addValue(listener);
            listener.onChange(this._value);
            return r;
        };

        unListen(ref: RefListRef<IListen>): void {
            if (this._listeners.isEmpty()) {
                //TODO check destroy
            }
        };

        onChange(val: any): void {
            this.updateValue(val);
        };

        setValue(val: any): void {
            if (this._bindingRef) {
                this._bindingRef.remove();
                this._bindingPath = null;
                this._bindingRef = null
            }
            if (val !== this._saved) {
                this._saved = val;
            }
            this.updateValue(val);
        };

        getValue(): void {
            return this._value;
        };

        setBinding(path: string): void {
            if (path === this._bindingPath) return;

            if (this._bindingRef !== null) {
                this._bindingRef.remove();
            }
            this._saved = null;
            this._bindingPath = path;
            this._pendingDispatch = true;

            if (path !== null) {
                this._bindingRef = this._block.createBinding(path, this);
            } else {
                this._bindingRef = null;
                this.updateValue(null);
            }
            if (this._pendingDispatch) {
                // notify binding changes to links
                this.dispatch();
            }
        };

        _load(val: any): void {
            this._saved = val;
            this._value = val;
            this.dispatch();
        };
    }
    BlockProperty.prototype.updateValue = IDispatch.prototype.updateValue;
    BlockProperty.prototype.onDispatch = IDispatch.prototype.onDispatch;
}
