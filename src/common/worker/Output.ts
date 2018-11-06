import {Types} from "../block/Type";
import {BlockFunction, FunctionData} from "../block/BlockFunction";
import {FunctionDesc} from "../block/Descriptor";
import {BlockIO} from "../block/BlockProperty";
import {Block, BlockMode} from "../block/Block";


export class OutputFunction extends BlockFunction {

  // return true when it needs to be put in queue
  inputChanged(input: BlockIO, val: any): boolean {
    return input._block._job.outputChanged(input, val);
  }

}

OutputFunction.prototype.priority = 3;
Types.add(OutputFunction, {name: 'output'});
