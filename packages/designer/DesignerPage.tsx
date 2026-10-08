import React, {memo} from 'react';
import {Block, type Flow} from '@ticlo/core';
import {TicloComp, useBlockValue} from '@ticlo/react';

export const DesignerPage = memo(function DesignerPage({flow}: {flow: Flow}) {
  const main = useBlockValue(flow, '#main');
  let page: React.ReactNode;
  if (main instanceof Block) {
    page = <TicloComp block={main} key={main._blockId} />;
  } else if (React.isValidElement(main)) {
    page = main;
  } else {
    page = <div className="ticl-d-empty">This flow has no #main component.</div>;
  }
  return <div className="ticl-d-page">{page}</div>;
});
