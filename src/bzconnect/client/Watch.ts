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
}
