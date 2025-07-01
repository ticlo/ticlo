import {Block, BlockChildWatch} from '../block/Block';
import {DataMap} from '../util/DataTypes';
import {WorkerFunctionGen} from './WorkerFunctionGen';
import {FlowWithShared, FlowWithSharedConfigGenerators} from '../block/SharedBlock';
import {BlockProperty} from '..';
import {ConstTypeConfig} from '../block/BlockConfigs';
import {BlockConfig} from '../block/BlockProperty';
import {SubflowLoader} from './WorkerControl';
import {defaultWorkerData} from '../defaults/DefaultFlows';
import {getBlockStoragePath} from '../util/Path';

export const FlowEditorConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowWithSharedConfigGenerators,
  '#is': ConstTypeConfig('flow:editor'),
};
export class FlowEditor extends FlowWithShared {
  getCacheKey(funcId: string, data: DataMap): any {
    // do not cache shared block during editing
    return this.getProperty('#shared', true);
  }

  unwatch(watcher: BlockChildWatch) {
    super.unwatch(watcher);
    if (!this._watchers) {
      this._prop.setValue(undefined);
    }
  }

  _createConfig(field: string): BlockProperty {
    if (field in FlowEditorConfigGenerators) {
      return new FlowEditorConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  static create(
    parent: Block,
    field: string,
    src?: DataMap,
    funcId?: string,
    forceLoad = false,
    applyChange?: (data: DataMap) => boolean
  ): FlowEditor {
    let prop = parent.getProperty(field);
    let flow: FlowEditor;
    if (prop._value instanceof FlowEditor) {
      // do not override the existing one that's being edited
      if (forceLoad) {
        flow = prop._value;
      } else {
        return prop._value;
      }
    } else {
      flow = new FlowEditor(parent, null, prop);
      prop.setOutput(flow);
    }
    if (funcId?.startsWith(':') && !applyChange) {
      applyChange = (data: DataMap) => {
        return WorkerFunctionGen.applyChangeToFunc(flow, null, null, data);
      };
    }
    let success = flow.load(src, funcId, applyChange);
    if (success) {
      return flow;
    } else {
      return null;
    }
  }

  static createFromField(parent: Block, field: string, fromField: string): FlowEditor {
    let fromValue = parent.getValue(fromField);
    let forceReload = false;
    // already has worker data ?
    if (fromValue && (typeof fromValue === 'string' || fromValue.constructor === Object)) {
      let newFlow: FlowEditor;
      if (typeof fromValue === 'string') {
        if (fromValue === '#') {
          const loader = SubflowLoader.getLoader(getBlockStoragePath(parent));
          loader.load((data: DataMap) => {
            if (!parent.isDestroyed() && parent.getValue(fromField) === '#') {
              newFlow = FlowEditor.create(parent, field, data ?? defaultWorkerData, null, false, (data: DataMap) => {
                loader.save(data);
                return true;
              });
            }
          });
          return null;
        } else {
          newFlow = FlowEditor.create(parent, field, null, fromValue);
        }
      } else {
        newFlow = FlowEditor.create(parent, field, fromValue as DataMap, null, false, (data: DataMap) => {
          parent.setValue(fromField, data);
          return true;
        });
      }

      if (newFlow) {
        return newFlow;
      }
      // reload the existing flow only when the previous loading failed
      forceReload = true;
    }

    if (parent._funcId) {
      let data = parent.getDefaultWorker(fromField) || defaultWorkerData;
      return FlowEditor.create(parent, field, data, null, forceReload, (data: DataMap) => {
        parent.setValue(fromField, data);
        return true;
      });
    }

    return null;
  }

  static createFromFunction(parent: Block, field: string, fromFunction: string, defaultData: DataMap): FlowEditor {
    if (typeof fromFunction === 'string') {
      return FlowEditor.create(parent, field, defaultData, fromFunction);
    }
    return null;
  }
}
