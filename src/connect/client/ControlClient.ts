module bzconnect {

    export class ControlClient {

        _conn: Connection;

        constructor(connect: Connection) {
            this._conn = connect;
        }

        setValue(path: string, val: any): void {
            this._conn.send([0, 'set', path, val]);
        }

        updateValue(path: string, val: any): void {
            this._conn.send([0, 'update', path, val]);
        }

        setBinding(path: string, binding: string): void {
            this._conn.send([0, 'bind', path, binding]);
        }

        createBlock(path: string): void {
            this._conn.send([0, 'create', path]);
        }


        watchObject(path: string, callback: WatchObjectCallback): void {

        }

        unwatchObject(path: string): void {

        }

        watchProperty(path: string, fields: Array<string>, callback: WatchValueCallback): void {

        }

        unwatchProperty(path: string, fields: Array<string>): void {

        }
    }
}
