/// <reference path="../breezeflow.ts" />
module BreezeFlow {

    export interface IListen {
        onChange(val: any): void;
    }
    export interface IDestroyable {
        destroy(): void;
    }

    /**
     * @interface
     */
    export class IDispatch {

        _listeners: RefList<IListen> = null;
        _block: Block = null;
        _value: any = null;

        listen(listener: IListen): RefListRef<IListen> {
            if (this._listeners == null) {
                this._listeners = new RefList<IListen>();
            }
            let ref = this._listeners.addValue(listener);
            listener.onChange(this._value);
            return ref;
        };

        unListen(ref: RefListRef<IListen>) {
            ref.remove();
            if (this._listeners !== null && this._listeners.isEmpty()) {
                this._listeners = null;
            }
        };


        updateValue(val: any): boolean {
            if (this._value === val) {
                return false;
            }
            this._value = val;
            this.dispatch();
            return true;
        };

        dispatch() :void {
            this._listeners.forEach(this.onDispatch, this);
        };

        onDispatch(listener: IListen) :void {
            listener.onChange(this._value);
        };

    }

    export function applyMixin(derived: any, base: any, fields:Array<string>) {
        fields.forEach(name => {
            derived.prototype[name] = base.prototype[name];
        });
    }

}