module breezeflow {

    class RefListBindingWrapper implements RefListRef<IListen> {
        _list: RefList<IListen>;
        value: IListen;
        _next: RefListRef<IListen> = null;
        _prev: RefListRef<IListen> = null;
        _parkedRef: RefListRef<IListen> = null;

        constructor(list: RefList<IListen>, val: IListen) {
            this._list = list;
            this.value = val;
        }

        removed(): boolean {
            return false;// to be mixin
        }

        remove(): void {
            // to be mixin
        };

        static destroy(wrapper: RefListBindingWrapper) {
            if (wrapper._parkedRef) {
                wrapper._parkedRef.remove();
            }
        };
    }


    export class BlockBinding implements IDispatch, IListen {
        _listeners: RefList<IListen> = null;

        _block: Block;
        _name: string;

        _value: any = null;

        _source: any = null;

        _parentRef: RefListRef<IListen> = null;

        _prop: BlockProperty = null;
        _boundPropChanged: (value: RefListRef<IListen>)=>void;

        constructor(block: Block, name: string) {
            this._block = block;
            this._name = name;

            this._boundPropChanged = BlockBinding.prototype.boundPropChanged.bind(this);
        }


        updateValue(val: any): boolean {
            return false; // to be mixin
        };

        dispatch(): void {
            // to be mixin
        };

        onDispatch(listener: IListen): void {
            // to be mixin
        };

        private static _addLinkSetNodeWrapper(list: RefList<IListen>, val: IListen): RefListBindingWrapper {
            let wrapper = new RefListBindingWrapper(list, val);
            RefList.insertBefore(wrapper, list._head);
            return wrapper;
        }

        unListen(wrapper: RefListRef<IListen>) {
            if ((wrapper as RefListBindingWrapper)._parkedRef) {
                (wrapper as RefListBindingWrapper)._parkedRef.remove();
            }
            if (this._listeners.isEmpty()) {
                this._listeners = null;
                //TODO destroy
            }
        }
        ;

        listen(listener: IListen): RefListRef<IListen> {
            if (this._listeners == null) {
                this._listeners = new RefList<IListen>(BlockBinding.prototype.unListen.bind(this));
            }
            let wrapper = BlockBinding._addLinkSetNodeWrapper(this._listeners, listener);

            if (this._prop != null) {
                wrapper._parkedRef = this._prop.listen(listener);
            } else {
                listener.onChange(this._value);
            }
            return wrapper;
        }
        ;


        onChange(val: any): any {
            if (this._source === val) {
                return;
            }
            this._source = val;
            if (val instanceof Block) {
                this._propChanged(val.getProp(this._name));
            } else {
                let bindingChanged = this._propChanged(null);
                let valueUpdated: boolean;
                if (val != null && val.__proto__ === Object.prototype && val.hasOwnProperty(this._name)) {
                    // drill down into object children
                    valueUpdated = this.updateValue(val[this._name]);
                } else {
                    valueUpdated = this.updateValue(null);
                }
                if (bindingChanged && !valueUpdated) {
                    // binding changed to null but value was not updated
                    // need an extra update on the value
                    this.dispatch();
                }
            }
        }
        ;

        _propChanged(prop: BlockProperty): boolean {
            if (prop == this._prop) return false;
            this._prop = prop;
            if (this._listeners) {
                this._listeners.forEachRef(this._boundPropChanged);
            }
            return true;
        }
        ;

        private boundPropChanged(wrapper: RefListBindingWrapper): void {
            if (wrapper._parkedRef) {
                wrapper.remove();
            }
            if (this._prop) {
                wrapper._parkedRef = this._prop.listen(wrapper.value);
            } else {
                wrapper._parkedRef = null;
            }
        }
        ;

        destroy() {
            if (this._listeners) {
                this._listeners.forEach(null, RefListBindingWrapper.destroy);
                this._listeners.clear();
            }
            if (this._parentRef) {
                this._parentRef.remove();
            }
        }
        ;

    }
    BlockBinding.prototype.updateValue = IDispatch.prototype.updateValue;
    BlockBinding.prototype.dispatch = IDispatch.prototype.dispatch;
    BlockBinding.prototype.onDispatch = IDispatch.prototype.onDispatch;


}
