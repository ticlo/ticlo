module bzflow {
    export class TcError {
        type: string;
        message: string;

        constructor(type: string, message: string) {
            this.type = type;
            this.message = message;
        }
    }
}