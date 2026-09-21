import {FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor.ts';
import {ClientCallbacks, ClientDescListener, SubscribeCallbacks, ValueUpdate} from './ClientRequests.ts';

import {DataMap} from '../util/DataTypes.ts';
import {StreamDispatcher} from '../block/Dispatcher.ts';
import {Query} from './Query.ts';
import type {EditPolicy, EditPolicyView} from '../policy/EditPolicy.ts';
import type {ClientConnection} from './ClientConnection.ts';

/** Shared command API for physical connections and policy views. */

export abstract class ClientConn {
  /** Creates an independent policy view of the base connection. Omit policy to use the base itself. */
  abstract withPolicy(policy?: EditPolicy): ClientConn;

  abstract simpleRequest(data: DataMap): Promise<any>;
  abstract simpleRequest(data: DataMap, callbacks: ClientCallbacks): Promise<any> | string;
  abstract sendValueRequest(data: DataMap, important?: boolean | ClientCallbacks): Promise<any> | string;

  abstract getEditPolicyView(): EditPolicyView;
  abstract editPolicyChanges(): StreamDispatcher<EditPolicyView>;

  abstract getBaseConn(): ClientConnection;

  abstract childrenChangeStream(): StreamDispatcher<{path: string; showNode?: boolean}>;

  abstract callImmediate(f: () => void): void;

  abstract lockImmediate(source: any): void;

  abstract unlockImmediate(source: any): void;

  /**
   * Sets the value of a property at the given path.
   * unimportant request may be merged with other set request on same path
   * @param path path of the property to set
   * @param value new value to set
   * @param important whether the request is important and shouldn't be merged
   */
  setValue(path: string, value: any, important: boolean | ClientCallbacks = false): Promise<any> | string {
    return this.sendValueRequest({cmd: 'set', path, value}, important);
  }

  /**
   * Updates the value of a property at the given path without replacing the entire property.
   * Calls `property.updateValue(value)`, which is useful for partial object updates.
   * unimportant request may be merged with other set request on same path
   * @param path path of the property to update
   * @param value partial or new value to update
   * @param important whether the request is important and shouldn't be merged
   */
  updateValue(path: string, value: any, important: boolean | ClientCallbacks = false): Promise<any> | string {
    return this.sendValueRequest({cmd: 'update', path, value}, important);
  }

  /**
   * Restores a property to its internally saved state (`_saved`).
   * This is used when the current working value diverges from the saved value.
   * @param path path of the property to restore
   * @param callbacks request callbacks
   */
  restoreSaved(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'restoreSaved', path}, callbacks);
  }

  /**
   * Creates a data binding from a property to a source path.
   * @param path path of the property that will receive the binding
   * @param from the target expression or path string to bind from
   * @param absolute If true, `from` is a fully qualified absolute path (which the server converts to a relative binding based on context).
   *   If `from` is undefined, the binding is removed and the current evaluated primitive value is kept.
   * @param important whether the request is important and shouldn't be merged
   */
  setBinding(
    path: string,
    from: string,
    absolute = false,
    important: boolean | ClientCallbacks = false
  ): Promise<any> | string {
    return this.sendValueRequest({cmd: 'bind', path, from, absolute}, important);
  }

  /**
   * Retrieves the current value of the property.
   * @param path path of the property
   */
  getValue(path: string): Promise<any> {
    return this.simpleRequest({cmd: 'get', path});
  }

  /**
   * Creates a new child Block. The server extracts the parent block and the new block's name from `path`.
   * @param path path for the new block
   * @param data initial data to load into the newly created block
   * @param findName if true, the server auto-generates a unique name if a block with that name already exists
   * @param callbacks request callbacks
   */
  addBlock(path: string, data?: DataMap, findName = false, callbacks?: ClientCallbacks): Promise<any> | string {
    const result = this.simpleRequest({cmd: 'addBlock', path, data, findName}, callbacks);
    this.childrenChangeStream().dispatch({path: path.substring(0, path.lastIndexOf('.'))});
    return result;
  }

  /**
   * Creates a new Flow.
   * @param path path for the new Flow
   * @param data initial data to load into the newly created Flow
   * @param callbacks request callbacks
   */
  addFlow(path: string, data?: DataMap, callbacks?: ClientCallbacks): Promise<any> | string {
    const result = this.simpleRequest({cmd: 'addFlow', path, data}, callbacks);
    this.childrenChangeStream().dispatch({path: path.substring(0, path.lastIndexOf('.')), showNode: true});
    return result;
  }

  /**
   * Creates a new FlowFolder to organize multiple flows.
   * @param path path for the new folder
   * @param callbacks request callbacks
   */
  addFlowFolder(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    const result = this.simpleRequest({cmd: 'addFlowFolder', path}, callbacks);
    this.childrenChangeStream().dispatch({path: path.substring(0, path.lastIndexOf('.')), showNode: true});
    return result;
  }

  /**
   * Lists the block children of a Block as an overview.
   * @param path path to the Block whose children should be listed
   * @param filter regex pattern to match and filter child property names
   * @param max maximum number of child block references to return (default 16, max 1024)
   * @param callbacks request callbacks
   */
  list(path: string, filter?: string, max: number = 16, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'list', path, filter, max}, callbacks);
  }

  /**
   * Executes a tree query starting from a block to search or extract specific fields within its descendants.
   * @param path path to the Block serving as the root of the query
   * @param query the structural query object defining how to filter and map the nested blocks/properties
   * @param callbacks request callbacks
   */
  query(path: string, query: Query, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'query', path, query}, callbacks);
  }

  /**
   * Subscribes to value changes for a property, creating a continuous tracker.
   * @param path path of the property to subscribe to
   * @param callbacks subscriber callbacks
   * @param fullValue if not true, long value will be truncated
   */
  abstract subscribe(path: string, callbacks: SubscribeCallbacks, fullValue?: boolean): void;

  /**
   * Unsubscribes from the property's value changes.
   * @param path path of the tracked property
   * @param callbacks subscriber callbacks to remove
   */
  abstract unsubscribe(path: string, callbacks: SubscribeCallbacks): void;

  /**
   * Subscribes to structural changes, child configurations, and value changes within the Block.
   * @param path path to the Block to watch
   * @param callbacks request callbacks
   */
  abstract watch(path: string, callbacks: ClientCallbacks): void;

  /**
   * Stops the watch on the given Block.
   * @param path path to the watched Block
   * @param callbacks request callbacks to remove
   */
  abstract unwatch(path: string, callbacks: ClientCallbacks): void;

  /**
   * Opens a FlowEditor block dynamically either from a specific user field or a base worker function.
   * The server matches the path to `#edit-...` and creates/loads the proper context so it can be viewed and edited in the UI.
   * @param path path indicating where the FlowEditor block resides (e.g. ending in `#edit-<id>`)
   * @param fromField if specified, editing starts based on an existing property field inside the block
   * @param fromFunction if specified, editing starts based on an existing global worker function
   * @param defaultData default data to initialize the editing context
   * @param funcLib optional path to the host flow whose `_funcLib` should own the resulting function (used for `:funcId` editing)
   * @param callbacks request callbacks
   */
  editWorker(
    path: string,
    fromField?: string,
    fromFunction?: string,
    defaultData?: DataMap,
    funcLib?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    return this.simpleRequest({cmd: 'editWorker', path, fromField, fromFunction, defaultData, funcLib}, callbacks);
  }

  /**
   * Commits and applies any pending internal changes generated by `Flow` into worker function.
   * @param path path corresponding to the Flow or FlowEditor that is being applied
   * @param funcId optional function id to directly assign the generated changes to
   * @param callbacks request callbacks
   */
  applyFlowChange(path: string, funcId?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'applyFlowChange', path, funcId}, callbacks);
  }

  /**
   * Deletes a registered worker function.
   * @param funcId the string identifier of the worker function
   * @param funcLib optional path to the host flow whose `_funcLib` owns an in-flow function
   * @param callbacks request callbacks
   */
  deleteFunction(funcId?: string, funcLib?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest(
      {
        cmd: 'deleteFunction',
        path: '#', // just to prevent the invalid path error
        funcId,
        funcLib,
      },
      callbacks
    );
  }

  /**
   * Shows properties within a Block so they're exposed in the UI.
   * @param path path to the parent Block
   * @param props array of property names to alter visibility for
   * @param callbacks request callbacks
   */
  showProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'showProps', path, props}, callbacks);
  }

  /**
   * Hides properties within a Block so they're not exposed in the UI.
   * @param path path to the parent Block
   * @param props array of property names to hide
   * @param callbacks request callbacks
   */
  hideProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'hideProps', path, props}, callbacks);
  }

  /**
   * Reorders a shown property relative to another sibling property in the block's shown properties list.
   * @param path path to the parent Block
   * @param propFrom the name of the property being moved
   * @param propTo the target sibling property name to move at
   * @param callbacks request callbacks
   */
  moveShownProp(path: string, propFrom: string, propTo: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'moveShownProp', path, propFrom, propTo}, callbacks);
  }

  /**
   * Modifies the array length of a Group property array dynamically.
   * @param path path to the parent Block containing the group
   * @param group the name of the group property
   * @param length the new designated length of the group array
   * @param callbacks request callbacks
   */
  setLen(path: string, group: string, length: number, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'setLen', path, group, length}, callbacks);
  }

  /**
   * Renames a property on a Block. Finds the property via the given path and moves it to `newName` on the parent Block.
   * @param path path of the property that is going to be renamed
   * @param newName the new string name for the property
   * @param callbacks request callbacks
   */
  renameProp(path: string, newName: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'renameProp', path, newName}, callbacks);
  }

  /**
   * Adds a user-defined custom property schema to a Block.
   * @param path path to the Block
   * @param desc descriptor mapping out the type, name, schema of the new custom property
   * @param group optional name of a group if the custom property is nested inside it
   * @param callbacks request callbacks
   */
  addCustomProp(
    path: string,
    desc: PropDesc | PropGroupDesc,
    group?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    return this.simpleRequest({cmd: 'addCustomProp', path, desc, group}, callbacks);
  }

  /**
   * Removes a user-defined custom property from the Block.
   * @param path path to the Block
   * @param name name of the custom property to be pruned
   * @param group optional name of a group if the custom property is nested inside it
   * @param callbacks request callbacks
   */
  removeCustomProp(path: string, name: string, group?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'removeCustomProp', path, name, group}, callbacks);
  }

  /**
   * Changes the ordering metadata of a custom property in the Block.
   * @param path path to the Block
   * @param nameFrom original name of the custom property
   * @param nameTo target location
   * @param group optional name of a group if the custom property is nested inside it
   * @param callbacks request callbacks
   */
  moveCustomProp(
    path: string,
    nameFrom: string,
    nameTo: string,
    group?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    return this.simpleRequest({cmd: 'moveCustomProp', path, nameFrom, nameTo, group}, callbacks);
  }

  /**
   * Instantiates or enables a predefined optional property on a Block.
   * @param path path to the Block
   * @param name name of the optional property
   * @param callbacks request callbacks
   */
  addOptionalProp(path: string, name: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'addOptionalProp', path, name}, callbacks);
  }

  /**
   * Removes an optional property from the Block.
   * @param path path to the Block
   * @param name name of the optional property to remove
   * @param callbacks request callbacks
   */
  removeOptionalProp(path: string, name: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'removeOptionalProp', path, name}, callbacks);
  }

  /**
   * Changes the ordering metadata of an optional property in the Block.
   * @param path path to the Block
   * @param nameFrom name of the optional property
   * @param nameTo target location
   * @param callbacks request callbacks
   */
  moveOptionalProp(path: string, nameFrom: string, nameTo: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'moveOptionalProp', path, nameFrom, nameTo}, callbacks);
  }

  /**
   * Inserts an unassigned new element inside a dynamic Block Group at `idx`.
   * @param path path to the Block
   * @param group name of the group
   * @param idx index defining where the new element is inserted
   * @param callbacks request callbacks
   */
  insertGroupProp(path: string, group: string, idx: number, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'insertGroupProp', path, group, idx}, callbacks);
  }

  /**
   * Splicing removes the element spanning index `idx` from a dynamic Block Group.
   * @param path path to the Block
   * @param group name of the group
   * @param idx index to prune from the group
   * @param callbacks request callbacks
   */
  removeGroupProp(path: string, group: string, idx: number, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'removeGroupProp', path, group, idx}, callbacks);
  }

  /**
   * Transposes the element in a dynamic Block Group sequence from an origin index to a new displacement index.
   * @param path path to the Block
   * @param group name of the group
   * @param oldIdx the index to move from
   * @param newIdx the index to move to
   * @param callbacks request callbacks
   */
  moveGroupProp(
    path: string,
    group: string,
    oldIdx: number,
    newIdx: number,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    return this.simpleRequest({cmd: 'moveGroupProp', path, group, oldIdx, newIdx}, callbacks);
  }

  /**
   * Resolves the tracked parent runtime `Flow` belonging to the block at `path` and reverses the latest operational change (undo stack).
   * @param path path to a block or property inside the target Flow context
   * @param callbacks request callbacks
   */
  undo(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'undo', path}, callbacks);
  }

  /**
   * Resolves the tracked parent runtime `Flow` belonging to the block at `path` and re-applies an undone state slice (redo stack).
   * @param path path to a block or property inside the target Flow context
   * @param callbacks request callbacks
   */
  redo(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'redo', path}, callbacks);
  }

  /**
   * Extracts specific serialized properties from a block entirely and returns the copied stringified structure.
   * If cut is true, the extracted properties are deleted from the block.
   * @param path path to the Block being targeted for copying
   * @param props array of string property fields to serialize
   * @param cut whether to delete the properties after copying
   * @param callbacks request callbacks
   */
  copy(path: string, props: string[], cut?: boolean, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'copy', path, props, cut}, callbacks);
  }

  /**
   * Relays a generic block-specific command (`command` parameter) payload down to the Component/Block implementation for executing bespoke logics.
   * @param path path of Block
   * @param command string command to be executed on the Block
   * @param params optional object arguments for the command
   * @param callbacks request callbacks
   */
  executeCommand(path: string, command: string, params?: DataMap, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'executeCommand', path, command, params}, callbacks);
  }

  /**
   * Loads serialized data structures onto the destination Block.
   * Evaluates logic resolution if keys/nodes collide using the literal `resolve` operation mode.
   * @param path path to the destination Block
   * @param data map representation of copied properties
   * @param resolve flag deciding collision behavior ('overwrite' | 'rename')
   * @param callbacks request callbacks
   */
  paste(
    path: string,
    data: DataMap,
    resolve?: 'overwrite' | 'rename',
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    return this.simpleRequest({cmd: 'paste', path, data, resolve}, callbacks);
  }

  /**
   * Directly triggers the function of a Block, like the default `onCall` hook behavior
   * @param path path of Block
   * @param callbacks request callbacks
   */
  callFunction(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'callFunction', path}, callbacks);
  }

  /**
   * Tells the Server-side Desc Watcher to proactively start relaying function signature modifications taking place under `id`.
   * @param funcId the function id to watch, use '*' to watch all functions
   * @param funcLib optional path of the Flow whose in-flow function descs should be watched
   * @param listener local listener hook interface mapping desc changes
   */
  abstract watchDesc(funcId: string, funcLib?: string, listener?: ClientDescListener): FunctionDesc;

  /**
   * Removes a desc listener
   * @param listener local listener hook interface mapping desc changes
   */
  abstract unwatchDesc(listener: ClientDescListener): void;

  abstract getCategory(category: string): FunctionDesc;

  abstract getCommonBaseFunc(set: Set<FunctionDesc>, funcLib?: string): FunctionDesc;

  abstract getOptionalProps(desc: FunctionDesc, funcLib?: string): {[key: string]: PropDesc};

  abstract findGlobalBlocks(tags: string[]): string[];

  abstract cancel(id: string): void;
}

export class ValueSubscriber {
  conn: ClientConn;
  path: string;
  fullValue: boolean;

  wasValid = false;
  constructor(public callbacks: SubscribeCallbacks) {}

  onUpdate(response: ValueUpdate): void {
    this.callbacks?.onUpdate?.(response);
    this.wasValid = true;
  }

  onError(error: string, data?: DataMap): void {
    if (this.wasValid) {
      this.wasValid = false;
      this.reSubscribe();
    } else {
      this.callbacks?.onError?.(error, data);
    }
  }

  subscribe(conn: ClientConn, path: string, fullValue = false) {
    if (this.conn === conn && this.path === path && this.fullValue === fullValue) {
      return;
    }
    if (
      this.conn &&
      conn &&
      this.conn.getBaseConn() === conn.getBaseConn() &&
      this.path === path &&
      this.fullValue === fullValue
    ) {
      this.conn = conn;
      return;
    }
    this.fullValue = fullValue;
    if (this.conn && this.path) {
      this.conn.unsubscribe(this.path, this);
    }
    this.conn = conn;
    this.path = path;
    if (this.conn && this.path) {
      this.conn.subscribe(this.path, this, fullValue);
    }
  }

  reSubscribe() {
    if (this.conn && this.path) {
      this.conn.subscribe(this.path, this, this.fullValue);
    }
  }

  unsubscribe() {
    if (this.conn && this.path) {
      this.conn.unsubscribe(this.path, this);
      this.conn = null;
      this.path = null;
    }
  }
}
