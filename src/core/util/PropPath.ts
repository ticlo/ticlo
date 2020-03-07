import {Block} from '../block/Block';
import {Job, Root} from '../block/Job';
import {BlockProperty, HelperProperty} from '../block/BlockProperty';

function propRelativeImpl(
  job: Job,
  baseBlock: Block,
  fromBlock: Block,
  fromField: string,
  pathPrefix?: string
): string {
  let fromBlocks: Block[] = [];
  while (fromBlock !== job) {
    fromBlocks.push(fromBlock);
    fromBlock = fromBlock._parent;
  }

  let resultPaths: string[] = [];

  // path go up
  if (pathPrefix) {
    resultPaths.push(pathPrefix);
  }
  let baseBlocks: Block[] = [];
  let firstLayerBase = baseBlock._parent === job;
  while (baseBlock !== job) {
    baseBlocks.push(baseBlock);
    if (baseBlock._prop instanceof HelperProperty && baseBlock._parent._parent === job) {
      // helper block should check if owner block is first layer
      firstLayerBase = true;
    }
    baseBlock = baseBlock._parent;
  }
  let commonParent: Block = job;
  while (baseBlocks.length && baseBlocks[baseBlocks.length - 1] === fromBlocks[fromBlocks.length - 1]) {
    commonParent = baseBlocks.pop();
    fromBlocks.pop();
  }
  if (baseBlocks.length) {
    if (commonParent === job && !firstLayerBase) {
      // first layer binding should use ## instead of ###, to make it easy to copy paste blocks to other layer
      if (pathPrefix != null) {
        // pathPrefix point to child job root, so ### would point to self, need ##.###
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

  if (baseBlock._job === fromBlock._job) {
    // base and from in same job
    return propRelativeImpl(baseBlock._job, baseBlock, fromBlock, from._name);
  } else {
    // base and from different jobs
    let baseJob = baseBlock._job;
    let fromJob = fromBlock._job;
    let fromJobs: Job[] = [];
    let baseJobs: Job[] = [];

    // trace job tree
    while (fromJob && fromJob !== Root.instance) {
      fromJobs.push(fromJob);
      fromJob = fromJob._parent._job;
    }
    while (baseJob && baseJob !== Root.instance) {
      baseJobs.push(baseJob);
      baseJob = baseJob._parent._job;
    }
    let commonJob: Job = Root.instance;
    // find common job
    while (baseJobs.length && baseJobs[baseJobs.length - 1] === fromJobs[fromJobs.length - 1]) {
      commonJob = baseJobs.pop();
      fromJobs.pop();
    }

    if (baseJobs.length === 0) {
      // binding source is a sub job in the base job
      return propRelativeImpl(commonJob, baseBlock, fromBlock, from._name);
    }

    let resultPaths: string[] = [];
    for (let job of baseJobs) {

      if (job === base._job) {
        if (base !== job) {
          resultPaths.unshift('###');
        }
      } else {
        resultPaths.push('##.###');
      }
    }
    return propRelativeImpl(commonJob, baseJobs[baseJobs.length - 1], fromBlock, from._name, resultPaths.join('.'));
  }
  // TODO, bind from service job
}
