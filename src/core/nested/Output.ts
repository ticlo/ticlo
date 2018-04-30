import { Classes } from "../block/Class";
import { BlockFunction, FunctionData } from "../block/BlockFunction";
import { FunctionDesc } from "../block/Descriptor";
import { BlockIO } from "../block/BlockProperty";
import { Block, BlockMode } from "../block/Block";
import { Job } from "../block/Job";

class OutputFunction extends BlockFunction {
  constructor(block: FunctionData) {
    super(block);
  }
}
