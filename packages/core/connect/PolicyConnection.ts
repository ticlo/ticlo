import {ClientConn} from './ClientConn.ts';
import type {ClientConnection} from './ClientConnection.ts';
import type {ClientCallbacks} from './ClientRequests.ts';
import type {DataMap} from '../util/DataTypes.ts';
import {StreamDispatcher} from '../block/Dispatcher.ts';
import {type EditPolicy, EditPolicyView} from '../policy/EditPolicy.ts';

/** An immutable client policy view. Transport, subscriptions and caches belong to the base connection. */
export class PolicyConnection extends ClientConn {
  get policy(): EditPolicy {
    return this.view.policy;
  }
  private readonly view: EditPolicyView;
  private readonly changes = new StreamDispatcher<EditPolicyView>();

  constructor(
    private readonly base: ClientConnection,
    policy: EditPolicy
  ) {
    super();
    this.view = new EditPolicyView(policy);
  }

  getBaseConn() {
    return this.base;
  }
  withPolicy(policy?: EditPolicy) {
    return this.base.withPolicy(policy);
  }
  getEditPolicyView() {
    return this.view;
  }
  editPolicyChanges() {
    return this.changes;
  }

  simpleRequest(data: DataMap): Promise<any>;
  simpleRequest(data: DataMap, callbacks: ClientCallbacks): Promise<any> | string;
  simpleRequest(data: DataMap, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.base.simpleRequest(data, callbacks, this.policy);
  }

  sendValueRequest(data: DataMap, important: boolean | ClientCallbacks = false): Promise<any> | string {
    return this.base.sendValueRequest(data, important, this.policy);
  }

  childrenChangeStream: ClientConn['childrenChangeStream'] = () => this.base.childrenChangeStream();
  callImmediate: ClientConn['callImmediate'] = (f) => this.base.callImmediate(f);
  lockImmediate: ClientConn['lockImmediate'] = (source) => this.base.lockImmediate(source);
  unlockImmediate: ClientConn['unlockImmediate'] = (source) => this.base.unlockImmediate(source);
  subscribe: ClientConn['subscribe'] = (...args) => this.base.subscribe(...args);
  unsubscribe: ClientConn['unsubscribe'] = (...args) => this.base.unsubscribe(...args);
  watch: ClientConn['watch'] = (...args) => this.base.watch(...args);
  unwatch: ClientConn['unwatch'] = (...args) => this.base.unwatch(...args);
  watchDesc: ClientConn['watchDesc'] = (...args) => this.base.watchDesc(...args);
  unwatchDesc: ClientConn['unwatchDesc'] = (...args) => this.base.unwatchDesc(...args);
  getCategory: ClientConn['getCategory'] = (...args) => this.base.getCategory(...args);
  getCommonBaseFunc: ClientConn['getCommonBaseFunc'] = (...args) => this.base.getCommonBaseFunc(...args);
  getOptionalProps: ClientConn['getOptionalProps'] = (...args) => this.base.getOptionalProps(...args);
  findGlobalBlocks: ClientConn['findGlobalBlocks'] = (...args) => this.base.findGlobalBlocks(...args);
  cancel: ClientConn['cancel'] = (id) => this.base.cancel(id);
}
