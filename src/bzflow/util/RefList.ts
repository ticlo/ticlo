module bzflow {
    export class RefListRef<ValueType> {
        _list: RefList<ValueType>;
        value: ValueType;
        _next: RefListRef<ValueType>;
        _prev: RefListRef<ValueType>;

        constructor(list: RefList<ValueType>, val: ValueType) {
            this._list = list;

            this.value = val;

            this._next = null;

            this._prev = null;
        }

        removed(): boolean {
            return this._list == null;
        }

        remove(): void {
            if (this._list != null) {
                this._list.remove(this);
            }
        };

    }

    export class RefList<ValueType> {
        _owner: Object = null;

        _removeCallback: (ref: RefListRef<ValueType>)=>void;

        _head: RefListRef<ValueType>;

        _iter: RefListRef<ValueType> = null;

        _iterEnd: RefListRef<ValueType> = null;

        constructor(removeCallback: (ref: RefListRef<ValueType>)=>void = null) {
            this._removeCallback = removeCallback;

            this._head = new RefListRef(this, null);

            this._head._prev = this._head;
            this._head._next = this._head;
        }


        isEmpty(): boolean {
            return this._head._next === this._head;
        };

        isNotEmpty(): boolean {
            return this._head._next !== this._head;
        };

        addValue(val: ValueType): RefListRef<ValueType> {
            let ref = new RefListRef(this, val);
            RefList.insertBefore(ref, this._head);
            return ref;
        };

        add(ref: RefListRef<ValueType>) {
            ref._next = this._head;
            ref._prev = this._head._prev;
            this._head._prev._next = ref;
            this._head._prev = ref;
        };

        addFirst(ref: RefListRef<ValueType>) {
            ref._next = this._head._next;
            ref._prev = this._head;
            this._head._next._prev = ref;
            this._head._next = ref;
        };


        static insertBefore<ValueType>(ref: RefListRef<ValueType>, base: RefListRef<ValueType>): void {
            ref._next = base;
            ref._prev = base._prev;
            base._prev._next = ref;
            base._prev = ref;
        };


        remove(ref: RefListRef<ValueType>) {
            if (ref._list !== this) {
                return;
            }
            if (ref === this._iter) {
                if (this._iter === this._iterEnd) {
                    this._iter = null;
                    this._iterEnd = null;
                } else {
                    this._iter = this._iter._next;
                }
            } else if (ref === this._iterEnd) {
                if (this._iter === this._iterEnd) {
                    this._iter = null;
                    this._iterEnd = null;
                } else {
                    this._iterEnd = this._iterEnd._prev;
                }
            }
            ref._next._prev = ref._prev;
            ref._prev._next = ref._next;
            ref._list = null;

            if (this._removeCallback != null) {
                this._removeCallback(ref);
            }
        };

        forEach(callback: (value: ValueType)=>void, caller: Object = null) {
            if (this._iter != null) throw 'Concurrent RefList Iteration';
            if (this._head._next == this._head) {
                return;
            }
            this._iter = this._head._next;
            this._iterEnd = this._head._prev;

            while (this._iter) {
                let current = this._iter;
                if (this._iter === this._iterEnd) {
                    this._iter = null;
                    this._iterEnd = null;
                } else {
                    this._iter = this._iter._next;
                }
                callback.call(caller, current.value);
            }
        };

        forEachRef(callback: (value: RefListRef<ValueType>)=>void, caller: Object = null) {
            if (this._iter != null) throw 'Concurrent RefList Iteration';
            if (this._head._next == this._head) {
                return;
            }
            this._iter = this._head._next;
            this._iterEnd = this._head._prev;

            while (this._iter) {
                let current = this._iter;
                if (this._iter === this._iterEnd) {
                    this._iter = null;
                    this._iterEnd = null;
                } else {
                    this._iter = this._iter._next;
                }
                callback.call(caller, current);
            }
        };

        /** fast way to remove ref, because its prev and next no longer need to be maintained */
        static _clearRef<ValueType>(ref: RefListRef<ValueType>) {
            ref._list = null;
        }

        clear() {
            if (this._iter != null)
                throw 'clear() Ignored during RefList Iteration';

            this.forEachRef(RefList._clearRef, null);
            this._head._prev = this._head;
            this._head._next = this._head;
        };


    }
}