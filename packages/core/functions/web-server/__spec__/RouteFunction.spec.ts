import {expect} from 'vitest';
import '../RouteFunction.js';
import type {RouteFunction} from '../RouteFunction.js';
import '../../../worker/HandlerFunction.js';
import type {Block} from '../../../block/Block.js';
import {Flow, Root} from '../../../block/Flow.js';
import {getDefaultFuncData} from '../../../block/Descriptor.js';
import {globalFunctions} from '../../../block/Functions.js';
import {HttpRequest} from '../HttpRequest.js';
import {FlowEditor} from '../../../worker/FlowEditor.js';

const flowData = {
  '#is': '',
  'route': {'#is': 'web-server:route'},
  'handler': {'#is': 'handler'},
};
describe('RouteFunction', function () {
  it('register route', function () {
    const flow = new Flow();

    const serviceLog: any[] = [];
    const mockService = {
      addRoute(path: string, route: RouteFunction) {
        serviceLog.push(['+', path]);
      },
      removeRoute(path: string, route: RouteFunction) {
        serviceLog.push(['-', path]);
      },
    };

    const aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'web-server:route',
    });

    aBlock.setValue('path', '0');
    aBlock.setValue('path', '1');
    aBlock.setValue('server', mockService);
    aBlock.setValue('path', '2');
    aBlock.setValue('server', null);
    aBlock.setValue('server', mockService);
    expect(serviceLog).toEqual([
      ['+', '1'],
      ['-', '1'],
      ['+', '2'],
      ['-', '2'],
      ['+', '2'],
    ]);
    serviceLog.length = 0;
    aBlock.setValue('#is', '');
    expect(serviceLog).toEqual([['-', '2']]);
  });

  it('emit', function () {
    const flow = new Flow();

    let routeFunction: RouteFunction;
    const mockService = {
      addRoute(path: string, route: RouteFunction) {
        routeFunction = route;
      },
      removeRoute() {},
    };

    const aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'web-server:route',
      'path': 'a',
      'server': mockService,
    });
    aBlock.getProperty('#emit');
    const request = new HttpRequest({} as any);
    routeFunction.addRequest(request);
    Root.run();
    expect(aBlock.getValue('#emit')).toBe(request);
  });

  it('edit worker', function () {
    const flow = new Flow();
    flow.load({
      '#is': '',
      'route': {'#is': 'web-server:route'},
      'handler': {'#is': 'handler', '~#call': '##.route.#emit'},
    });
    const route = flow.getValue('route') as Block;
    const handler = flow.getValue('handler') as Block;
    FlowEditor.createFromField(handler, '#edit-use', 'use');

    expect((handler.getValue('#edit-use') as Flow).save()).toEqual(route.getDefaultWorker('#emit'));
  });
});
