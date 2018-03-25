module bzconnect {
    export interface Connection {
        send(data: any[]): void;
        listen(callback: (data: any[])=>void): void;
    }
}











