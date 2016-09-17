module bzconnect {
    export interface WatchObjectUpdate {
        path: string;
        type?: string;
        updates: {[key: string]: Object};
    }
    export interface WatchValueUpdate {
        path: string;
        updates: {[key: string]: any};
    }

    export type WatchObjectCallback = (block: WatchObjectUpdate)=>void;
    export type WatchValueCallback = (block: WatchValueUpdate)=>void;

    export interface ControlClient {
        setValue(path: string, val: any): void;
        updateValue(path: string, val: any): void;
        setBinding(path: string, binding: string): void;
        createBlock(path: string): void;

        watchObject(path: string, callback: WatchObjectCallback): void;
        unwatchObject(path: string): void;

        watchProperty(path: string, fields: Array<string>, callback: WatchValueCallback): void;
        unwatchProperty(path: string, fields: Array<string>): void;
    }
}
