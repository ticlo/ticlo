import React from 'react';
import {Block, type Flow} from '@ticlo/core';
import {TicloComp, useBlockValue} from '@ticlo/react';

export function DesignerPage({flow}: {flow: Flow}) {
  const main = useBlockValue(flow, '#main');
  let page: React.ReactNode;
  if (main instanceof Block) {
    page = <TicloComp block={main} key={main._blockId} />;
  } else if (React.isValidElement(main)) {
    page = main;
  } else {
    page = <div style={{padding: 24}}>This flow has no #main component.</div>;
  }
  return (
    <div className="ticl-designer-page" style={{height: '100%', overflow: 'auto', background: '#fff'}}>
      {page}
    </div>
  );
}
