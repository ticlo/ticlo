import {BlockFunction} from '../../block/BlockFunction';
import {NO_EMIT} from '../../block/Event';
import {Functions} from '../../block/Functions';
import {HttpRequest} from './HttpRequest';
import {deepEqual} from '../../util/Compare';
import {DataMap} from '../../util/DataTypes';
import {getDefaultDataFromCustom} from '../../block/Descriptor';

const defaultRouteWorker = {
  '#is': '',
  '#inputs': getDefaultDataFromCustom([
    {name: 'method', type: 'string'},
    {name: 'path', type: 'string'},
    {name: 'body', type: 'any'},
    {name: 'query', type: 'object'},
    {name: 'headers', type: 'object'},
  ]),
  '#outputs': getDefaultDataFromCustom([
    {name: 'data', type: 'any'},
    {name: 'headers', type: 'object'},
    {name: 'status', type: 'number', min: 200, max: 999, step: 1, default: 200},
  ]),
};

export type RouteContentType = 'empty' | 'text' | 'json' | 'buffer' | 'form';
const contentTypeList: RouteContentType[] = ['empty', 'text', 'json', 'buffer', 'form'];

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
const methodList: RouteMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

export interface RouteService {
  addRoute(path: string, route: RouteFunction): void;
  removeRoute(path: string, route: RouteFunction): void;
}

export class RouteFunction extends BlockFunction {
  _pendingRequests: HttpRequest[] = [];
  addRequest(request: HttpRequest) {
    this._pendingRequests.push(request);
    this.queue();
  }

  static inputMap = new Map([
    ['path', RouteFunction.prototype._onPathChange],
    ['server', RouteFunction.prototype._onServerChange],
    ['method', RouteFunction.prototype._onMethodsChange],
    ['contentType', RouteFunction.prototype._onContentTypesChange],
  ]);
  getInputMap() {
    return RouteFunction.inputMap;
  }

  methods: RouteMethod[] = [];
  _onMethodsChange(val: any) {
    if (!Array.isArray(val)) {
      val = [];
    }
    if (deepEqual(val, this.methods)) {
      return false;
    }
    this.methods = val;
    return true;
  }

  contentTypes: RouteContentType[] = [];
  _onContentTypesChange(val: any) {
    if (!Array.isArray(val)) {
      val = [];
    }
    if (deepEqual(val, this.contentTypes)) {
      return false;
    }
    this.contentTypes = val;
    return true;
  }

  _path: string = null;
  _onPathChange(val: any) {
    if (typeof val !== 'string') {
      val = null;
    }
    if (val === this._path) {
      return false;
    }
    if (this._server) {
      if (this._path) {
        this._server.removeRoute(this._path, this);
      }
      this._path = val;
      if (this._path) {
        this._server.addRoute(this._path, this);
      }
    } else {
      this._path = val;
    }
  }
  _server: RouteService = null;
  _onServerChange(val: any) {
    if (Object.isExtensible(val) && !('addRoute' in val && 'removeRoute' in val)) {
      val = null;
    }
    if (val === this._server) {
      return false;
    }
    if (this._server && this._path) {
      this._server.removeRoute(this._path, this);
    }
    this._server = val;
    if (this._server && this._path) {
      this._server.addRoute(this._path, this);
    }
    return false;
  }

  run(): any {
    if (this._pendingRequests.length) {
      for (let i = 0; i < this._pendingRequests.length - 1; ++i) {
        this._data.emitOnly(this._pendingRequests[i]);
      }
      // let block use the default
      let result = this._pendingRequests[this._pendingRequests.length - 1];
      this._pendingRequests.length = 0;
      return result;
    }
    return NO_EMIT;
  }

  getDefaultWorker(field: string): DataMap {
    if (field === '#emit') {
      return defaultRouteWorker;
    }
    return null;
  }

  destroy(): void {
    if (this._server && this._path) {
      this._server.removeRoute(this._path, this);
    }
    super.destroy();
  }
}

Functions.add(
  RouteFunction,
  {
    name: 'route',
    icon: 'fas:network-wired',
    mode: 'onCall',
    properties: [
      {name: 'server', type: 'service', options: ['route-server']},
      {name: 'path', type: 'string'},
      {name: 'method', type: 'multi-select', options: methodList, init: ['GET']},
      {name: 'contentType', type: 'multi-select', options: contentTypeList, init: ['empty']},
    ],
  },
  'http'
);
