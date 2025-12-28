import {
  RouteContentType,
  RouteFunction,
  RouteMethod,
  RouteService,
} from '@ticlo/core/functions/web-server/RouteFunction.js';
import {Functions, type Block} from '@ticlo/core';
import {BaseFunction, StatefulFunction} from '@ticlo/core/block/BlockFunction.js';
import {FastifyRequest, FastifyReply} from 'fastify';
import {decodeReviver, encode} from '@ticlo/core/util/Serialize.js';
import {escapedObject} from '@ticlo/core/util/EscapedObject.js';
import {Uid} from '@ticlo/core/util/Uid.js';
import {HttpRequest} from './HttpRequest.js';
import {Resolver} from '@ticlo/core/block/Resolver.js';

const serviceId: Uid = new Uid();
export const requestHandlerSymbol = Symbol('requestHandler');

export class ServerFunction extends BaseFunction<Block> {
  strictRoute: Map<string, Set<RouteFunction>> = new Map();
  wildcardRoute: Map<string, Set<RouteFunction>> = new Map();

  pendingTasks: HttpRequest[] = [];

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

  requestHandler = async (basePath: string, req: FastifyRequest, res: FastifyReply) => {
    let contentType: RouteContentType;
    let body: any;

    // Parse content based on content-type
    const contentTypeHeader = req.headers['content-type'] as string;

    if (contentTypeHeader) {
      if (contentTypeHeader.includes('application/json')) {
        contentType = 'json';
        try {
          body = typeof req.body === 'string' ? JSON.parse(req.body, decodeReviver) : req.body;
        } catch (e) {
          body = req.body;
        }
      } else if (contentTypeHeader.includes('text/plain')) {
        contentType = 'text';
        body = req.body;
      } else if (contentTypeHeader.includes('application/x-www-form-urlencoded')) {
        contentType = 'urlencoded';
        body = req.body;
      } else if (contentTypeHeader.includes('application/octet-stream')) {
        contentType = 'buffer';
        body = req.body;
      } else {
        contentType = 'empty';
        body = undefined;
      }
    } else {
      contentType = 'empty';
      body = undefined;
    }

    // Create a modified request object with parsed body
    const modifiedReq = {...req, body};

    let path = req.url.substring(basePath.length);
    // Remove query string if present
    const queryIndex = path.indexOf('?');
    if (queryIndex !== -1) {
      path = path.substring(0, queryIndex);
    }

    const method: string = req.method;
    const targetRoute: RouteFunction[] = [];

    let statusError = 404;
    // check static route
    if (this.strictRoute.has(path)) {
      for (const route of this.strictRoute.get(path)) {
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
      const pathParts = path.split('/');
      while (pathParts.pop()) {
        const parentPath = pathParts.join('/');
        if (this.wildcardRoute.has(parentPath)) {
          for (const route of this.wildcardRoute.get(parentPath)) {
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
      return res.code(statusError).send();
    }

    const emitTask = () => {
      const request = new HttpRequest(modifiedReq as any, res, basePath);
      if (this.pendingTasks.length === 0) {
        Resolver.callLater(this.checkPendingTasks);
      }
      this.pendingTasks.push(request);
      for (const route of targetRoute) {
        route.addRequest(request);
      }
    };

    emitTask();
  };

  service: RouteService = escapedObject(`server-${serviceId.next(10)}`, {
    addRoute: (path: string, routeFunction: RouteFunction) => {
      const [targetRoute, targetPath] = this.chooseRouteType(path);
      let routes: Set<RouteFunction> = targetRoute.get(targetPath);
      if (!routes) {
        routes = new Set();
        targetRoute.set(targetPath, routes);
      }
      routes.add(routeFunction);
    },
    removeRoute: (path: string, routeFunction: RouteFunction) => {
      const [targetRoute, targetPath] = this.chooseRouteType(path);
      const routes: Set<RouteFunction> = targetRoute.get(targetPath);
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
    for (const task of this.pendingTasks) {
      if (!task._handler) {
        task.res.code(501).send();
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
    name: 'server',
    icon: 'fas:network-wired',
    properties: [{name: '#output', pinned: true, type: 'object', readonly: true}],
    tags: ['route-server'],
  },
  'web-server'
);
