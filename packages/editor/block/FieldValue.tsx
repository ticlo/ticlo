import React, {useContext, useEffect, useRef} from 'react';
import {useConnectionValue} from '../component/useConnectionValue.ts';
import {ClientConn} from '@ticlo/core/editor.ts';
import {Popup} from '../component/ClickPopup.tsx';
import {ObjectTree} from '../object-tree/ObjectTree.tsx';
import {TicloLayoutContextType} from '../component/LayoutContext.ts';
import {renderValue} from '../component/renderValue.tsx';

interface Props {
  conn: ClientConn;
  path: string;
}

export const FieldValue = React.memo(function FieldValue({conn, path}: Props) {
  const value = useConnectionValue(conn, path);
  const context = useContext(TicloLayoutContextType);
  const objectTree = useRef<{close?: () => void}>({});

  useEffect(() => {
    const source = objectTree.current;
    return () => {
      source.close?.();
      source.close = undefined;
    };
  }, [conn, path]);

  const getObjectMenu = () => <ObjectTree conn={conn} path={path} data={value} />;
  const onExpandObjectTree = (e: React.MouseEvent) => {
    if (context?.showObjectTree) {
      context.showObjectTree(path, value, e.target as HTMLElement, objectTree.current);
      const source = objectTree.current;
      source.close = () => context.closeObjectTree?.(path, source);
      e.stopPropagation();
    }
  };

  const getObjectPopup = () => (
    <Popup
      popup={getObjectMenu}
      popupAlign={{
        points: ['tl', 'tr'],
        offset: [-6, 0],
      }}
    >
      <div className="ticl-tree-arr ticl-tree-arr-expand" onDoubleClick={onExpandObjectTree} />
    </Popup>
  );

  return <div className="ticl-field-value">{renderValue(value, getObjectPopup)}</div>;
});
