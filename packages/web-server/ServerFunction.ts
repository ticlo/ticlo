import {
  RouteContentType,
  RouteFunction,
  RouteMethod,
  RouteService,
} from '@ticlo/core/functions/web-server/RouteFunction';
import {Functions} from '@ticlo/core';
import {BaseFunction, StatefulFunction} from '@ticlo/core/block/BlockFunction';
import * as Express from 'express';
import {decodeReviver, encode} from '@ticlo/core/util/Serialize';
import {escapedObject} from '@ticlo/core/util/EscapedObject';
import {Uid} from '@ticlo/core/util/Uid';
import {ExpressHttpRequest} from './HttpRequest';
import {Resolver} from '@ticlo/core/block/Resolver';
import type {Block} from '@ticlo/core';

const urlencodedParser = Express.urlencoded({extended: false});
const jsonParser = Express.json({reviver: decodeReviver});
const textParser = Express.text();
const bufferParser = Express.raw();

const serviceId: Uid = new Uid();
export const requestHandlerSymbol = Symbol('requestHandler');

export class ServerFunction extends BaseFunction<Block> {
  strictRoute: Map<string, Set<RouteFunction>> = new Map();
  wildcardRoute: Map<string, Set<RouteFunction>> = new Map();

  pendingTasks: ExpressHttpRequest[] = [];

  chooseRouteType(path: string): [Map<string, Set<RouteFunction>>, string] {
    let targetRoutes: Map<string, Set<RouteFunction>>;
    if (path.endsWith('*')) {
      targetRoutes = this.wildcardRoute;
      path = path.substring(0, path.length - 1);
    } else {
      targetRoutes = this.strictRoute;
    }
    if (path.endsWith('/')) {
      path = path.substring(0, path.length - 1);
    }
    return [targetRoutes, path];
  }

  requestHandler = (basePath: string, req: Express.Request, res: Express.Response) => {
    let contentType: RouteContentType;
    let midware: Express.RequestHandler;

    switch (req.headers['content-type']) {
      case 'application/json':
        contentType = 'json';
        midware = jsonParser;
        break;
      case 'text/plain':
        contentType = 'text';
        midware = textParser;
        break;
      case 'application/x-www-form-urlencoded':
        contentType = 'urlencoded';
        midware = urlencodedParser;
        break;
      // case 'multipart/form-data':
      //   contentType = 'multi-part';
      //   midware = multipartParser;
      //   break;
      case 'application/octet-stream':
        contentType = 'buffer';
        midware = bufferParser;
        break;
      default:
        contentType = 'empty';
    }
    let path = req.path.substring(basePath.length);
    let method: string = req.method;
    let targetRoute: RouteFunction[] = [];

    let statusError = 404;
    // check static route
    if (this.strictRoute.has(path)) {
      for (let route of this.strictRoute.get(path)) {
        if (!route.methods.includes(method as RouteMethod)) {
          statusError = 405;
          continue;
        }
        if (!route.contentTypes.includes(contentType)) {
          statusError = 415;
          continue;
        }
        targetRoute.push(route);
      }
    }
    // check dynamic route
    if (targetRoute.length === 0) {
      let pathParts = path.split('/');
      while (pathParts.pop()) {
        let parentPath = pathParts.join('/');
        if (this.wildcardRoute.has(parentPath)) {
          for (let route of this.wildcardRoute.get(parentPath)) {
            if (!route.methods.includes(method as RouteMethod)) {
              statusError = 405;
              continue;
            }
            if (!route.contentTypes.includes(contentType)) {
              statusError = 415;
              continue;
            }
            targetRoute.push(route);
          }
          if (targetRoute.length > 0) {
            break;
          }
        }
      }
    }
    if (targetRoute.length === 0) {
      res.status(statusError).end();
      return;
    }
    const emitTask = () => {
      let request = new ExpressHttpRequest(req, basePath);
      if (this.pendingTasks.length === 0) {
        Resolver.callLater(this.checkPendingTasks);
      }
      this.pendingTasks.push(request);
      for (let route of targetRoute) {
        route.addRequest(request);
      }
    };
    if (midware) {
      midware(req, res, emitTask);
    } else {
      emitTask();
    }
  };

  service: RouteService = escapedObject(`express-server-${serviceId.next(10)}`, {
    addRoute: (path: string, routeFunction: RouteFunction) => {
      let [targetRoute, targetPath] = this.chooseRouteType(path);
      let routes: Set<RouteFunction> = targetRoute.get(targetPath);
      if (!routes) {
        routes = new Set();
        targetRoute.set(targetPath, routes);
      }
      routes.add(routeFunction);
    },
    removeRoute: (path: string, routeFunction: RouteFunction) => {
      let [targetRoute, targetPath] = this.chooseRouteType(path);
      let routes: Set<RouteFunction> = targetRoute.get(targetPath);
      if (routes) {
        routes.delete(routeFunction);
        if (routes.size === 0) {
          targetRoute.delete(targetPath);
        }
      }
    },
    [requestHandlerSymbol]: this.requestHandler,
  });

  checkPendingTasks = () => {
    for (let task of this.pendingTasks) {
      if (!task._handler) {
        task.req.res.status(501).end();
        // prevent handler to process in the future
        task._handler = task;
      }
    }
    this.pendingTasks.length = 0;
  };

  run() {
    this._data.output(this.service);
  }
}

Functions.add(
  ServerFunction,
  {
    name: 'express-server',
    icon: 'fas:network-wired',
    properties: [{name: '#output', pinned: true, type: 'object', readonly: true}],
    tags: ['route-server'],
  },
  'web-server'
);
