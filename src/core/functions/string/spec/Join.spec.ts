import expect from 'expect';
import '../Join';
import {Block} from '../../../block/Block';
import {Flow, Root} from '../../../block/Flow';

describe('Join', function () {
  it('basic join', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'join',
      '0': 2,
      '1': 'a',
    });

    Root.run();

    expect(aBlock.getValue('#output')).toEqual('2a');

    aBlock.setValue('0', null);

    Root.run();
    expect(aBlock.getValue('#output')).toEqual(undefined);

    aBlock.setValue('0', ['b', 'c']);

    Root.run();
    expect(aBlock.getValue('#output')).toEqual('bca');

    aBlock.setValue('separator', ',');

    Root.run();
    expect(aBlock.getValue('#output')).toEqual('b,c,a');

    aBlock.setValue('[]', 1);

    Root.run();
    expect(aBlock.getValue('#output')).toEqual('b,c');

    aBlock.setValue('[]', 0);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual('');
  });
});
