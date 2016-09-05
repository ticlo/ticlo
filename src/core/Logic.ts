module breezeflow {

    export class Logic implements IDestroyable {
        _block: Block;
        type: string;
        priority: number;
        initRun: boolean;

        constructor(block: Block) {
            this._block = block;
        }

        static _logic_sample_descriptor: LogicDesc = {
            'inputs': [{'name': '>input', 'type': 'string', 'editor': 'enum[a,b,c]'}],
            'outputs': [{'name': '<output', 'type': 'number'}],
            'attributes': [{'name': '@attribute', 'type': 'number'}],
        };

        getDescriptor(): LogicDesc {
            return Logic._logic_sample_descriptor;
        };

        // return true when it needs to be put in queue
        inputChanged(input: BlockInput, val: any): boolean {
            return true;
        };

        // return stream output
        run(val: any): any {
            // example
        };

        checkInitRun(): boolean {
            return true;
        };

        checkInitTrigger(loading: boolean): void {

        };

        blockCommand(command: string, params: Object): void {

        }

        propCommand(command: string, field: string, params: Object): void {

        }

        destroy(): void {
        };


    }
    Logic.prototype.type = '';

    Logic.prototype.priority = 0;

    /**
     * whether the logic should be run right after it's created
     */
    Logic.prototype.initRun = false;

    export type LogicType = new (block: Block)=>Logic;
}