import {assert} from 'chai';
import {getFuncStyleFromDesc} from '../Descriptor';

describe('Descriptor', function() {
  it('getFuncStyleFromDesc', function() {
    assert.equal(getFuncStyleFromDesc({style: 'repeater', priority: 1, name: 't1'}), 'ticl-block-prr');
    assert.equal(getFuncStyleFromDesc({priority: 1, name: 't2'}), 'ticl-block-pr1');
    assert.equal(getFuncStyleFromDesc({name: 't3'}), '');
  });
});
