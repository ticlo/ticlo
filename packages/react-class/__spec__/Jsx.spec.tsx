import {Flow, Root} from '@ticlo/core';
import {transform} from '@babel/standalone';
import '../Jsx.js';

describe('Jsx', function () {
  (window as any).Babel = {transform};

  it('basic', async function () {
    let flow = new Flow();
    let aBlock = flow.createBlock('a');
    aBlock.setValue('#is', 'react:jsx');
    aBlock.setValue('script', 'return <span />');
    Root.run();
    expect(aBlock.getValue('#render')).toMatchSnapshot();
  });

  it('functional', async function () {
    let flow = new Flow();
    let aBlock = flow.createBlock('a');
    aBlock.setValue('#is', 'react:jsx');
    aBlock.setValue('value', 'v');
    aBlock.setValue(
      'script',
      `return function Foo({data}){
  return <span>{data.value}</span>;
  }`
    );
    Root.run();
    expect(aBlock.getValue('#render')).toMatchSnapshot();
  });
});
