/// <reference path="../breezeflow.ts" />
module BreezeFlow {
    class BzError {
        type: string;
        message: string;

        constructor(type: string, message: string) {
            this.type = type;
            this.message = message;
        }
    }
}