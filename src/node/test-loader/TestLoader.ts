import Path from 'path';
import Fs from 'fs';
import {BlockProperty, DataMap, decode, Flow, Root} from '../../../src/core';
import {FlowLoader, FlowState} from '../../../src/core/block/Flow';
import {FlowTestGroup} from '../../../src/test/FlowTestGroup';
import {FlowTestCase} from '../../../src/test/FlowTestCase';
import {FileFlowStorage, FlowIOTask} from '../storage/FileStorage';

interface TestLoaderOptions {
  timeout?: number;
  onDemandLoad?: boolean;
  ignoreFolders?: string[];
}

export class TestLoader extends FileFlowStorage {
  flowToPathMap = new Map<string, string>();
  timeout: number;
  onDemandLoad: boolean;
  ignoreFolders: string[];
  constructor(map: ([string, string] | string)[], options?: TestLoaderOptions) {
    super('.');
    this.timeout = options?.timeout ?? 5000;
    this.onDemandLoad = Boolean(options?.onDemandLoad);
    this.ignoreFolders = options?.ignoreFolders ?? ['i18n', 'spec'];
    for (let item of map) {
      let path: string;
      let flow: string;
      if (Array.isArray(item)) {
        [path, flow] = item;
      } else {
        path = item;
        flow = path.split('/').pop();
      }
      path = Path.resolve(path);
      this.flowToPathMap.set(flow, path);
    }
  }
  getTask(name: string): FlowIOTask {
    let nameParts = name.split('.');
    if (nameParts[0] !== 'tests' || !this.flowToPathMap.has(nameParts[1])) {
      throw new Error('trying to save/load an invalid test path');
    }
    nameParts.shift();
    nameParts[0] = this.flowToPathMap.get(nameParts[0]);
    let filename: string;
    if (nameParts.includes('#')) {
      // subflow
      let pos = nameParts.indexOf('#') - 2;
      filename = nameParts.slice(pos).join('.');
      nameParts = nameParts.slice(0, pos);
    } else {
      filename = nameParts.pop();
    }

    let specDir = `${nameParts.join('/')}/tests`;
    let realPath = `${specDir}/${filename}`;

    if (this.tasks.has(realPath)) {
      return this.tasks.get(realPath);
    } else {
      if (!Fs.existsSync(specDir)) {
        Fs.mkdirSync(specDir);
      }
      let task = new FlowIOTask(this, name, `${realPath}.ticlo`);
      this.tasks.set(name, task);
      return task;
    }
  }
  saveFlow(flow: Flow, data?: DataMap, overrideKey?: string) {
    if (flow?._disabled) {
      let key = overrideKey ?? flow._storageKey;
      console.log(`unable to save disabled flow: ${key}`);
      return;
    }
    super.saveFlow(flow, data, overrideKey);
  }

  getFlowLoader(key: string, prop: BlockProperty): FlowLoader {
    if (prop == null || prop._block instanceof FlowTestGroup) {
      return {
        createFlow: (path: string, p: BlockProperty) => {
          let testCase = new FlowTestCase(p._block, p, this.timeout, p._block as FlowTestGroup);
          if (!this.inited) {
            // test cases created during initialization should not start all at same time
            testCase.updateValue('#disabled', true);
          }
          return testCase;
        },
        applyChange: (data: DataMap) => {
          this.saveFlow(null, data, key);
          return true;
        },
        onStateChange: (flow: Flow, state: FlowState) => this.flowStateChanged(flow, key, state),
      };
    }
    return {};
  }
  async flowStateChanged(flow: Flow, key: string, state: FlowState) {
    if (this.onDemandLoad) {
      switch (state) {
        case FlowState.enabled: {
          let task = this.getTask(key);
          let str = await task.read();
          try {
            let data = decode(str);
            flow.loadData(data);
          } catch (err) {
            console.log(`failed to load test:${task.path} ${err.toString()}`);
          }
          break;
        }
        case FlowState.disabled: {
          flow._liveUpdate({});
          break;
        }
      }
    }
    super.flowStateChanged(flow, key, state);
  }
  init(root: Root): void {
    const testGroupLoader = {
      createFolder: (path: string, p: BlockProperty) =>
        new FlowTestGroup(p._block, p, this.timeout, p._block instanceof FlowTestGroup ? p._block : null),
    };

    let flowFiles: string[] = [];
    // let functionFiles: string[] = [];

    const loadSpec = (dir: string, parentBlockPath: string) => {
      let specDir = Path.join(dir, 'tests');
      if (Fs.existsSync(specDir)) {
        let stat = Fs.statSync(specDir);
        if (stat.isDirectory()) {
          for (let file of Fs.readdirSync(specDir)) {
            if (
              file.endsWith('.ticlo') &&
              !file.startsWith('#') // Do not load subflow during initialization.
            ) {
              try {
                let data = {};
                if (!this.onDemandLoad) {
                  data = decode(Fs.readFileSync(Path.join(specDir, file), 'utf8'));
                }
                let name = file.substring(0, file.length - 6);
                let blockPath = `${parentBlockPath}.${name}`;
                root.addFlow(blockPath, data, this.getFlowLoader(blockPath, null));
              } catch (e) {
                console.log(`failed to load test:${file} ${e.toString()}`);
              }
            }
          }
        }
      }
    };
    const iterateDir = (dir: string, blockPath: string) => {
      root.addFlowFolder(blockPath, testGroupLoader);
      for (let file of Fs.readdirSync(dir)) {
        if (file.includes('.')) {
          continue;
        }
        let path = Path.join(dir, file);
        let stat = Fs.statSync(path);
        if (stat.isDirectory()) {
          if (file !== 'tests' && !this.ignoreFolders.includes(file)) {
            iterateDir(path, `${blockPath}.${file}`);
          }
        }
      }
      loadSpec(dir, blockPath);
    };
    root.addFlowFolder('tests', testGroupLoader);
    for (let [flow, path] of this.flowToPathMap) {
      iterateDir(path, `tests.${flow}`);
    }
    this.inited = true;
  }
}
