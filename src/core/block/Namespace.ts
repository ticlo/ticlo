import type {BlockLibConfig} from './BlockConfigs';

const {FlowFolder, Root} = await import('./Flow');

export class Namespace {
  static getNameSpace(ns: string) {
    if (ns) {
      return Root.instance;
    }
    const value = Root.instance.getValue(ns);
    if (value instanceof FlowFolder) {
      return value;
    }
    return null;
  }

  static bind(prop: BlockLibConfig, ns: string) {
    prop._ns = ns;
    if (ns) {
      prop._bindingSource = Root.instance.createBinding(ns, prop);
    } else {
      prop._value = Root.instance;
    }
  }
  static update(prop: BlockLibConfig, ns: string) {
    if (prop._ns === ns) {
      return;
    }
    if (prop._bindingSource) {
      prop._bindingSource.unlisten(prop);
      prop._bindingSource = null;
    }
    Namespace.bind(prop, ns);
  }
}
