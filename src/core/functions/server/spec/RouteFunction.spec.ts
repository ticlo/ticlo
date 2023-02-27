import {assert} from 'chai';
import '../RouteFunction';
// tslint:disable-next-line:no-duplicate-imports
import {RouteFunction} from '../RouteFunction';
import '../../../worker/HandlerFunction';
import {Block} from '../../../block/Block';
import {Flow, Root} from '../../../block/Flow';
import {getDefaultFuncData} from '../../../block/Descriptor';
import {Functions} from '../../../block/Functions';
import {HttpRequest} from '../HttpRequest';
import {FlowEditor} from '../../../worker/FlowEditor';

const flowData = {
  '#is': '',
  'route': {'#is': 'http:route'},
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
      '#is': 'http:route',
    });

    aBlock.setValue('path', '0');
    aBlock.setValue('path', '1');
    aBlock.setValue('server', mockService);
    aBlock.setValue('path', '2');
    aBlock.setValue('server', null);
    aBlock.setValue('server', mockService);
    assert.deepEqual(serviceLog, [
      ['+', '1'],
      ['-', '1'],
      ['+', '2'],
      ['-', '2'],
      ['+', '2'],
    ]);
    serviceLog.length = 0;
    aBlock.setValue('#is', '');
    assert.deepEqual(serviceLog, [['-', '2']]);
  });

  it('method and contentType', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock._load(getDefaultFuncData(Functions.getDescToSend('http:route')[0]));

    assert.deepEqual(aBlock.getValue('method'), ['GET']);
    assert.deepEqual(aBlock.getValue('contentType'), ['empty']);

    aBlock.setValue('method', null);
    aBlock.setValue('method', 1);

    assert.deepEqual((aBlock._function as RouteFunction).methods, []);

    aBlock.setValue('contentType', null);
    aBlock.setValue('contentType', 1);

    assert.deepEqual((aBlock._function as RouteFunction).contentTypes, []);
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
      '#is': 'http:route',
      'path': 'a',
      'server': mockService,
    });
    aBlock.getProperty('#emit');
    let request = new HttpRequest({} as any);
    routeFunction.addRequest(request);
    Root.run();
    assert.equal(aBlock.getValue('#emit'), request);
  });

  it('edit worker', function () {
    let flow = new Flow();
    flow.load({
      '#is': '',
      'route': {'#is': 'http:route'},
      'handler': {'#is': 'handler', '~#call': '##.route.#emit'},
    });
    let route = flow.getValue('route') as Block;
    let handler = flow.getValue('handler') as Block;
    FlowEditor.createFromField(handler, '#edit-use', 'use');

    assert.deepEqual((handler.getValue('#edit-use') as Flow).save(), route.getDefaultWorker('#emit'));
  });
});
