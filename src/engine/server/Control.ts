module bzflow {
    export class Control {
        _root: BlockRoot;

        constructor(root: BlockRoot) {
            this._root = root;
        }

        setValue(path: string, val: any): void {

        }

        setBinding(path: string, binding: string): void {

        }

        createBlock(path: string): void {

        }

        createBinding(path: string, listener: IListen): RefListRef<IListen> {
            return null;
        }
    }
}
