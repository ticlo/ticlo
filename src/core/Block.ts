module breezeflow {

    export class Block {
        _root: BlockRoot;
        _prop: BlockProperty;
        _gen: number;
        _mode: string = 'auto';
        _props: {[key: string]: BlockProperty} = {};
        _bindings: {[key: string]: BlockBinding} = {};
        _logic: Logic = null;
        /// register to type change
        _typeRef: RefListRef<Block> = null;

        _loopRef: RefListRef<Block> = null;
        _loopRun: boolean = false;
        _loopRunning: boolean = false;
        _pOut: BlockOutput;

        _proxy: Object = null;

        constructor(root: BlockRoot, prop: BlockProperty) {

            this._root = root;

            this._prop = prop;

            this._gen = Loop.tick;

            this._pOut = this.getProp('<<');
        }

        getProxy(): Object {
            if (!this._proxy) {
                this._proxy = new Proxy(this, BlockProxy);
            }
            return this._proxy;
        }

        getProp(field: string): BlockProperty {
            if (this._props.hasOwnProperty(field)) {
                return this._props[field];
            }
            if (field === '') {
                return this._prop;
            }
            let firstChar = field.charCodeAt(0);
            let prop: BlockProperty;
            if (firstChar == 62) { // >
                prop = new BlockInput(this, field);
            } else if (firstChar == 60) { // <
                prop = new BlockOutput(this, field);
                let secondChar = field.charCodeAt(1);
                if (secondChar == 60) { // <<
                    this._initSysOutput(field, prop);
                }
            } else if (firstChar == 64) { // @
                prop = new BlockMeta(this, field);
            } else {
                prop = new BlockChild(this, field);
            }
            this._props[field] = prop;
            return prop;
        };

        createBinding(path: string, listener: IListen): RefListRef<IListen> {
            let pos = path.lastIndexOf('.');
            if (pos < 0) {
                return this.getProp(path).listen(listener);
            }
            if (this._bindings.hasOwnProperty(path)) {
                return this._bindings[path].listen(listener);
            }
            let parentPath = path.substring(0, pos);
            let field = path.substring(pos + 1);

            let binding = new BlockBinding(this, field);
            this._bindings[path] = binding;

            binding._parentRef = this.createBinding(parentPath, binding);

            return binding.listen(listener);
        };


        load(map: {[key: string]: any}) {
            this._load(map);
        };

        _load(map: {[key: string]: any}) {
            let pendingType: string;
            for (let key in map) {
                if (key !== '>>type') {
                    if (key.charCodeAt(0) === 126) { // ~ for binding
                        let val = map[key];
                        if (typeof val === 'string') {
                            let name = key.substring(1);
                            this.setBinding(name, val);
                        }
                    } else {
                        this.getProp('key')._load(map[key]);
                    }
                } else {
                    pendingType = map['>>type'];
                }
            }
            if (pendingType) {
                this.setValue('>>type', pendingType);
            }
        };


        merge(map: {[key: string]: any}) {

        };

        setValue(field: string, val: any): void {
            this.getProp(field).setValue(val);
        };

        updateValue(field: string, val: any): void {
            this.getProp(field).updateValue(val);
        };

        setBinding(field: string, path: string): void {
            this.getProp(field).setBinding(path);
        };

        getValue(field: string): any {
            if (this._props.hasOwnProperty(field)) {
                return this._props[field]._value;
            }
            return null;
        };

        createBlock(field: string): Block {
            let firstChar = field.charCodeAt(0);
            if (firstChar < 60 || firstChar > 64) {
                let prop = this.getProp(field);
                if (prop._value == null || prop._value._prop !== prop) {
                    let block = new Block(this._root, prop);
                    prop.setValue(block);
                    return block;
                }
            }
            return null;
        };

        inputChanged(input: BlockInput, val: any): void {
            if (input._isSysInput) {
                let inputName = input._name;
                switch (inputName) {
                    case '>>':
                        this.onRun(val);
                        break;
                    case '>>type':
                        this.typeChanged(val);
                        break;
                    case '>>trigger':
                        this.onTrigger(val);
                        break;
                    case '>>mode': // auto, delayed, trigger, disabled
                        this.onMode(val);
                        break;
                }
            } else if (this._logic) {
                if (this._logic.inputChanged(input, val)) {
                    if (this._mode !== 'manual') {
                        this.trigger();
                    }
                }
            }
        };

        run(): void {
            this._loopRun = true;
            this._loopRunning = true;
            let out = this._logic.run(null);
            this._loopRunning = false;
            if (out == null) {
                out = new BzEvent();
            }
            this._pOut.updateValue(out);
        };

        trigger(): void {
            if (!this._loopRef) {
                switch (this._mode) {
                    case 'disabled':
                        return;
                    case 'delayed':
                        if (this._gen !== Loop.tick) {
                            return;
                        }
                }
                Loop.addBlock(this);
            }
        };

        onMode(mode: any) {
            switch (mode) {
                case 'trigger':
                case 'delayed':
                    this._mode = mode;
                    break;
                case 'disabled':
                case 'false':
                case false:
                    this._mode = 'disabled';
                    break;
                default:
                    this._mode = 'auto';
            }
        };

        onRun(val: any): void {
            if (this._logic && this._mode !== 'disabled' && BzEvent.isValid(val)) {
                this._loopRun = true;
                let out = this._logic.run(val);
                if (out == null) {
                    out = val;
                }
                this._pOut.updateValue(out);
            }
        };

        onTrigger(val: any): void {
            if (this._logic && BzEvent.isValid(val)) {
                this.trigger();
            }
        };

        typeChanged(typeName: string) {
            if (this._typeRef) {
                this._typeRef.remove();
            }
            if (typeof(typeName) === 'string') {
                this._typeRef = Types.listen(typeName, this);
            } else {
                this._typeRef = null;
                this.updateLogic(null);
            }
        };

        updateLogic(Class: LogicType): void {
            if (this._logic) {
                this._logic.destroy();
            }
            if (Class) {
                this._logic = new Class(this);
                if (this._logic.checkInitRun()) {
                    this.trigger();
                }
            } else {
                this._logic = null;
            }
        };

        _initSysOutput(field: string, prop: BlockOutput): void {
            // TODO
        };

        destroy(): void {
            //TODO
        };
    }
}
