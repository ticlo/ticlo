import {expect} from 'vitest';
import '../RouteFunction.js';
import {RouteFunction} from '../RouteFunction.js';
import '../../../worker/HandlerFunction.js';
import {Block} from '../../../block/Block.js';
import {Flow, Root} from '../../../block/Flow.js';
import {getDefaultFuncData} from '../../../block/Descriptor.js';
import {Functions} from '../../../block/Functions.js';
import {HttpRequest} from '../HttpRequest.js';
import {FlowEditor} from '../../../worker/FlowEditor.js';

const flowData = {
  '#is': '',
  'route': {'#is': 'web-server:route'},
  'handler': {'#is': 'handler'},
};
describe('RouteFunction', function () {
  it('register route', function () {
    let flow = new Flow();

    const serviceLog: any[] = [];
    const mockService = {
      addRoute(path: string, route: RouteFunction) {
        serviceLog.push(['+', path]);
      },
      removeRoute(path: string, route: RouteFunction) {
        serviceLog.push(['-', path]);
      },
    };

    let aBlock = flow.createBlock('a');
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
    let flow = new Flow();

    let routeFunction: RouteFunction;
    const mockService = {
      addRoute(path: string, route: RouteFunction) {
        routeFunction = route;
      },
      removeRoute() {},
    };

    let aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'web-server:route',
      'path': 'a',
      'server': mockService,
    });
    aBlock.getProperty('#emit');
    let request = new HttpRequest({} as any);
    routeFunction.addRequest(request);
    Root.run();
    expect(aBlock.getValue('#emit')).toBe(request);
  });

  it('edit worker', function () {
    let flow = new Flow();
    flow.load({
      '#is': '',
      'route': {'#is': 'web-server:route'},
      'handler': {'#is': 'handler', '~#call': '##.route.#emit'},
    });
    let route = flow.getValue('route') as Block;
    let handler = flow.getValue('handler') as Block;
    FlowEditor.createFromField(handler, '#edit-use', 'use');

    expect((handler.getValue('#edit-use') as Flow).save()).toEqual(route.getDefaultWorker('#emit'));
  });
});
