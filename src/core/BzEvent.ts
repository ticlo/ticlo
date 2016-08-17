/// <reference path="../breezeflow.ts" />
module BreezeFlow {
    export class BzEvent {
        tick: number;

        constructor() {
            this.tick = Loop.tick;
        }


        static isValid(val: any) {
            if (val == null) {
                return false;
            }
            if (val instanceof BzEvent) {
                return val.tick == Loop.tick;
            }
            return true;
        };

    }
}