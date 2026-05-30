export class Restricted {
  path?: string;
  allowCmd?: string[];
  denyCmd?: string[];
  // affect setValue updateValue setBinding addFlow addFlowFolder
  allowProps?: string[];
}
