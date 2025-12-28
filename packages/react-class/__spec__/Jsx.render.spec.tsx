import {Flow, Root} from '@ticlo/core';
import {transform} from '@babel/standalone';
import '../Jsx.js';
import {creatReactRoot, ReactRoot} from './render.js';
import {ReactNode} from 'react';

describe('Jsx', function () {
  (window as any).Babel = {transform};

  let root: ReactRoot;
  beforeEach(function () {
    root = creatReactRoot();
  });
  afterEach(function () {
    root.remove();
  });

  it('hook', async function () {
    const flow = new Flow();
    const aBlock = flow.createBlock('a');
    aBlock.setValue('#is', 'react:jsx');
    aBlock.setValue(
      'script',
      `return function Bar({data}){
const [s, setS] = useState(1);
useEffect(()=>{
  setS(2);
},[])
return <span>{s}</span>;
}`
    );
    Root.run();
    await root.waitRender(aBlock.getValue('#render') as ReactNode);
    expect(root.div.innerHTML).toBe('<span>2</span>');
  });
});
