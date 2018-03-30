    export interface BlockProxyStructure {
        inputs?: Object;
        outputs?: Object;
    }

    const BlockInputProxy = {
        get: function (block: Block, field: string, receiver: Object): any {
            let prop = block._props['>' + field];
            if (prop) {
                return prop._value;
            }
            return null;
        },

        set: function (block: Block, field: string, value: any, receiver: Object): boolean {
            let prop = block.getProp('>' + field);
            prop.updateValue(value);
            return true;
        }
    };

    const BlockOutputProxy = {
        get: function (block: Block, field: string, receiver: Object): any {
            let prop = block._props['<' + field];
            if (prop) {
                let val = prop._value;
                if (val instanceof Block) {
                    return prop._value.getProxy();
                }
                return val;
            }
            return null;
        },

        set: function (block: Block, field: string, value: any, receiver: Object): boolean {
            let prop = block.getProp('<' + field);
            prop.updateValue(value);
            return true;
        }
    };

    export const BlockProxy = {
        get: function (block: Block, field: string, receiver: BlockProxyStructure): any {
            switch (field) {
                case '$in':
                    if (!receiver.inputs) {
                        receiver.inputs = new Proxy(block, BlockInputProxy);
                    }
                    return receiver.inputs;
                case '$out':
                    if (!receiver.outputs) {
                        receiver.outputs = new Proxy(block, BlockOutputProxy);
                    }
                    return receiver.outputs;
            }

            let prop = block._props[field];
            if (prop) {
                return prop._value;
            }
            return null;
        },

        set: function (block: Block, field: string, value: any, receiver: BlockProxyStructure): boolean {
            let prop = block.getProp(field);
            prop.updateValue(value);
            return true;
        }
    };

