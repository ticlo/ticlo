import {RouteContentType, RouteFunction, RouteMethod, RouteService} from '../core/functions/server/RouteFunction';
import {Functions} from '../../src/core/block/Functions';
import {BlockFunction} from '../../src/core/block/BlockFunction';
import {Request, Response, RequestHandler} from 'express';
import BodyParser from 'body-parser';
import {decodeReceiver, encode} from '../../src/core/util/Serialize';
import {escapedObject} from '../../src/core/util/EscapedObject';
import {Uid} from '../../src/core/util/Uid';
import {ExpressHttpRequest} from './HttpRequest';
import {Resolver} from '../../src/core/block/Resolver';

const formParser = BodyParser.urlencoded({extended: false});
const jsonParser = BodyParser.json({reviver: decodeReceiver});
const textParser = BodyParser.text({});
const bufferParser = BodyParser.raw({});

const serviceId: Uid = new Uid();

export class ServerFunction extends BlockFunction {
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
  });
  requestHandler = (basePath: string, req: Request, res: Response) => {
    let contentType: RouteContentType;
    let midware: RequestHandler;

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
        contentType = 'form';
        midware = formParser;
        break;
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

    // check static route
    if (this.strictRoute.has(path)) {
      for (let route of this.strictRoute.get(path)) {
        if (route.methods.includes(method as RouteMethod) && route.contentTypes.includes(contentType)) {
          targetRoute.push(route);
        }
      }
    }
    // check dynamic route
    if (targetRoute.length === 0) {
      let pathParts = path.split('/');
      while (pathParts.pop()) {
        let parentPath = pathParts.join('/');
        if (this.wildcardRoute.has(parentPath)) {
          for (let route of this.wildcardRoute.get(parentPath)) {
            if (route.methods.includes(method as RouteMethod) && route.contentTypes.includes(contentType)) {
              targetRoute.push(route);
            }
          }
          if (targetRoute.length > 0) {
            break;
          }
        }
      }
    }
    if (targetRoute.length === 0) {
      res.status(404).end();
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
  'server'
);
