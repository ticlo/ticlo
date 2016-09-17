module bzflow {
    export class BlockOutput extends BlockProperty {
        constructor(block: Block, name: string) {
            super(block, name);
        }

        setBinding(path: string): void {
            // output property ignores binding
        };
    }
}
