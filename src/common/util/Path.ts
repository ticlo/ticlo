import {Block, Job, Root} from "../block/Block";
import {BlockProperty, HelperProperty} from "../block/BlockProperty";
import {Logger} from "./Logger";


export function resolve(path1: string, path2: string, property?: BlockProperty): string {
  if (path2 == null) {
    return null;
  }
  let p1 = path1.split('.');
  let p2 = path2.split('.');

  loopwhile:
    while (p2.length > 0 && p1.length > 0) {
      switch (p2[0]) {
        case '##':
          // parent path
          p1.pop();
        /* falls through */
        case '#':
          // shift is slow, but this should not be a common thing in binding
          p2.shift();
          break;
        case '###':
          // stage path can't be resolved just from the path string, can not resolve
          Logger.warn(`can not resolve base path ${path1} with ${path2}`);
          return path2;
        default:
          break loopwhile;
      }
    }
  return p1.concat(p2).join('.');
}

export function resolveJobPath(property: BlockProperty, path: string): string {
  if (path.startsWith('###.')) {
    return `${property._block._job.fullPath()}${path.substr(3)}`;
  }
  return path;
}

export function relative(base: string, from: string): string {
  if (base === from) {
    return '';
  }
  let p1 = base.split('.');
  let p2 = from.split('.');
  let pos = 0;
  while (p1[pos] === p2[pos]) {
    ++pos;
  }
  let str2 = p2.slice(pos).join('.');
  return str2.padStart(str2.length + (p1.length - pos) * 3, '##.');
}


function propRelativeImpl(job: Job, baseBlock: Block, fromBlock: Block, fromField: string, pathPrefix?: string): string {
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
  if (commonParent === job && !firstLayerBase) {
    // first layer binding should use ## instead of ###, to make it easy to copy paste blocks to other layer
    if (pathPrefix) {
      // pathPrefix point to child job root, so ### would point to self, need ##.###
      resultPaths.push('##');
    }
    resultPaths.push('###');
  } else {
    for (let block of baseBlocks) {
      resultPaths.push('##');
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
    return (propRelativeImpl(baseBlock._job, baseBlock, fromBlock, from._name));
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
      // binding target is a sub job in the base job
      return propRelativeImpl(commonJob, baseBlock, fromBlock, from._name);
    }

    let resultPaths: string[] = [];
    for (let job of baseJobs) {
      resultPaths.push('###');
    }
    return propRelativeImpl(commonJob, baseJobs[baseJobs.length - 1], fromBlock, from._name, resultPaths.join('.##.'));
  }
  // TODO, bind from service job
}

// call all paths in between, including the target path but not the base path
// callback: return true to break
export function forAllPathsBetween(target: string, base: string, callback: (value: string) => boolean) {
  if (!target.startsWith(base)) {
    return;
  }
  if (callback(target)) {
    return;
  }
  let targetParts = target.split('.');
  let baseParts = base.split('.');

  for (let len = targetParts.length - 1; len > baseParts.length; --len) {
    if (callback(targetParts.slice(0, len).join('.'))) {
      return;
    }
  }
}