module bzflow {
    export class TcEvent {
        tick: number;

        constructor() {
            this.tick = Loop.tick;
        }


        static isValid(val: any) {
            if (val == null) {
                return false;
            }
            if (val instanceof TcEvent) {
                return val.tick == Loop.tick;
            }
            return true;
        };

    }
}