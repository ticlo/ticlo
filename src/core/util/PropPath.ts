import {Block} from '../block/Block';
import {Flow, Root} from '../block/Flow';
import {BlockProperty, HelperProperty} from '../block/BlockProperty';

function propRelativeImpl(
  flow: Flow,
  baseBlock: Block,
  fromBlock: Block,
  fromField: string,
  pathPrefix?: string
): string {
  let fromBlocks: Block[] = [];
  while (fromBlock !== flow) {
    fromBlocks.push(fromBlock);
    fromBlock = fromBlock._parent;
  }

  let resultPaths: string[] = [];

  // path go up
  if (pathPrefix) {
    resultPaths.push(pathPrefix);
  }
  let baseBlocks: Block[] = [];
  let firstLayerBase = baseBlock._parent === flow;
  while (baseBlock !== flow) {
    baseBlocks.push(baseBlock);
    if (baseBlock._prop instanceof HelperProperty && baseBlock._parent._parent === flow) {
      // helper block should check if owner block is first layer
      firstLayerBase = true;
    }
    baseBlock = baseBlock._parent;
  }
  let commonParent: Block = flow;
  while (baseBlocks.length && baseBlocks[baseBlocks.length - 1] === fromBlocks[fromBlocks.length - 1]) {
    commonParent = baseBlocks.pop();
    fromBlocks.pop();
  }
  if (baseBlocks.length) {
    if (commonParent === flow && !firstLayerBase) {
      // first layer binding should use ## instead of ###, to make it easy to copy paste blocks to other layer
      if (pathPrefix != null) {
        // pathPrefix point to child flow root, so ### would point to self, need ##.###
        resultPaths.push('##');
      }
      resultPaths.push('###');
    } else {
      for (let block of baseBlocks) {
        resultPaths.push('##');
      }
    }
  }

  // path go down
  for (let i = fromBlocks.length - 1; i >= 0; --i) {
    resultPaths.push(fromBlocks[i]._prop._name);
  }
  resultPaths.push(fromField);

  return resultPaths.join('.');
}

// find a optimized full path
export function propRelative(base: Block, from: BlockProperty): string {
  let baseBlock = base;
  let fromBlock = from._block;

  if (baseBlock._flow === fromBlock._flow) {
    // base and from in same flow
    return propRelativeImpl(baseBlock._flow, baseBlock, fromBlock, from._name);
  } else {
    // base and from different flows
    let baseFlow = baseBlock._flow;
    let fromFlow = fromBlock._flow;
    let fromFlows: Flow[] = [];
    let baseFlows: Flow[] = [];

    // trace flow tree
    while (fromFlow && fromFlow !== Root.instance) {
      fromFlows.push(fromFlow);
      fromFlow = fromFlow._parent._flow;
    }
    while (baseFlow && baseFlow !== Root.instance) {
      baseFlows.push(baseFlow);
      baseFlow = baseFlow._parent._flow;
    }
    let commonFlow: Flow = Root.instance;
    // find common flow
    while (baseFlows.length && baseFlows[baseFlows.length - 1] === fromFlows[fromFlows.length - 1]) {
      commonFlow = baseFlows.pop();
      fromFlows.pop();
    }

    if (baseFlows.length === 0) {
      // binding source is a sub flow in the base flow
      return propRelativeImpl(commonFlow, baseBlock, fromBlock, from._name);
    }

    let resultPaths: string[] = [];
    for (let flow of baseFlows) {
      if (flow === base._flow) {
        if (base !== flow) {
          resultPaths.unshift('###');
        }
      } else {
        resultPaths.push('##.###');
      }
    }
    return propRelativeImpl(commonFlow, baseFlows[baseFlows.length - 1], fromBlock, from._name, resultPaths.join('.'));
  }
  // TODO, bind from service flow
}
