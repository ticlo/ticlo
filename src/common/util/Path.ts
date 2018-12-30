import {BlockProperty} from "../block/BlockProperty";
import {Block, Job, Root} from "../block/Block";

export function resolve(path1: string, path2: string): string {
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
          p2.shift();
          break;
        case '###':
          // stage path can't be resolved just from the path string, can not concat
          // TODO need a better solution to show binding wire
          return path2;
        default:
          break loopwhile;
      }
    }
  return p1.concat(p2).join('.');
}

export function relative(from: string, to: string): string {
  if (from === to) {
    return '';
  }
  let p1 = from.split('.');
  let p2 = to.split('.');
  let pos = 0;
  while (p1[pos] === p2[pos]) {
    ++pos;
  }
  let str2 = p2.slice(pos).join('.');
  return str2.padStart(str2.length + (p1.length - pos) * 3, '##.');
}


function propRelativeImpl(job: Job, fromBlock: Block, toBlock: Block, field: string, overrideUpRoute?: string): string {
  let toBlocks: Block[] = [];
  while (toBlock !== job) {
    toBlocks.push(toBlock);
    toBlock = toBlock._parent;
  }

  let resultPaths: string[] = [];

  // path go up
  if (overrideUpRoute) {
    resultPaths.push(overrideUpRoute);
  } else {
    let fromBlocks: Block[] = [];

    while (fromBlock !== job) {
      fromBlocks.push(fromBlock);
      fromBlock = fromBlock._parent;
    }
    let commonParent: Block = job;
    while (fromBlocks[fromBlocks.length - 1] === toBlocks[toBlocks.length - 1]) {
      commonParent = fromBlocks.pop();
      toBlocks.pop();
    }
    if (commonParent === job) {
      if (fromBlock._parent === job) {
        resultPaths.push('##');
      } else {
        resultPaths.push('###');
      }
    } else {
      for (let str of fromBlocks) {
        resultPaths.push('##');
      }
    }
  }

  // path go down
  for (let i = toBlocks.length; i >= 0; --i) {
    resultPaths.push(toBlocks[i]._prop._name);
  }
  resultPaths.push(field);

  return resultPaths.join('.');
}

// find a optimized full path
export function propRelative(from: Block, to: BlockProperty): string {
  let fromBlock = from;
  let toBlock = to._block;


  if (fromBlock._job === toBlock._job) {
    // from and to in same job
    return (propRelativeImpl(fromBlock._job, fromBlock, toBlock, to._name));
  } else {
    // from and to different jobs
    let fromJob = fromBlock._job;
    let toJob = toBlock._job;
    let toJobs: Job[] = [];
    let fromJobs: Job[] = [];

    // trace job tree
    while (toJob && toJob !== Root.instance) {
      toJobs.push(toJob);
      toJob = toJob._job;
    }
    while (fromJob && fromJob !== Root.instance) {
      fromJobs.push(fromJob);
      fromJob = fromJob._job;
    }
    let commonJob: Job = Root.instance;
    // find common job
    while (fromJobs[fromJobs.length - 1] === toJobs[toJobs.length - 1]) {
      commonJob = fromJobs.pop();
      toJobs.pop();
    }

    if (fromJobs.length === 0) {
      // binding target is a sub job in the from job
      return propRelativeImpl(commonJob, fromBlock, toBlock, to._name);
    }

    let resultPaths: string[] = ['###'];
    for (let str of fromJobs) {
      resultPaths.push('###');
    }
    return propRelativeImpl(commonJob, fromBlock, toBlock, to._name, resultPaths.join('.'));
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