import React from 'react';
import {Dropdown} from 'antd';
import {CheckOutlined, FileFilled, FileOutlined, FolderOpenOutlined} from '@ant-design/icons';
import {ExpandIcon} from '../component/Tree.tsx';
import {t} from '../component/LocalizedLabel.tsx';

export interface StoredFlowItem {
  key: string;
  name: string;
  level: number;
  children: Map<string, StoredFlowItem>;
  autoLoad?: boolean;
  canAutoLoad?: boolean;
}

export function StoredFlowRenderer({
  item,
  style,
  expanded,
  onExpand,
  onOpen,
  onAutoLoad,
  canLoad,
  canAutoLoad,
}: {
  item: StoredFlowItem;
  style: React.CSSProperties;
  expanded: boolean;
  onExpand: () => void;
  onOpen: () => void;
  onAutoLoad: () => void;
  canLoad: boolean;
  canAutoLoad: boolean;
}) {
  const folder = item.children.size > 0;
  const content = (
    <div className="ticl-e-tree-node-content ticl-e-stored-flow" onDoubleClick={folder ? onExpand : onOpen}>
      {folder ? <FolderOpenOutlined /> : item.autoLoad ? <FileFilled /> : <FileOutlined />}
      <div className="ticl-e-tree-node-text">{item.name}</div>
    </div>
  );
  return (
    <div className="ticl-e-tree-node" style={{...style, marginLeft: item.level * 20}}>
      <ExpandIcon opened={folder ? (expanded ? 'opened' : 'closed') : 'disabled'} onClick={onExpand} />
      {folder ? (
        content
      ) : (
        <Dropdown
          trigger={['contextMenu']}
          menu={{
            items: [
              {key: 'load', label: t('Load'), disabled: !canLoad, onClick: onOpen},
              {
                key: 'autoLoad',
                label: t('Auto Load'),
                icon: <CheckOutlined style={{visibility: item.autoLoad ? 'visible' : 'hidden'}} />,
                disabled: !canAutoLoad,
                onClick: onAutoLoad,
              },
            ],
          }}
        >
          {content}
        </Dropdown>
      )}
    </div>
  );
}
