import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Tooltip} from 'antd';
import {blankFuncDesc, getDisplayName, isStringArray, stopPropagation, type FunctionDesc} from '@ticlo/core/editor.ts';
import type {ClientConn} from '@ticlo/core/editor.ts';
import {TIcon} from '../icon/Icon.tsx';
import {BlockDropdown} from '../popup/BlockDropdown.tsx';
import {getFuncStyleFromDesc} from '../util/BlockColors.ts';
import {getDescModule} from '../util/FunctionModule.ts';
import {useConnectionValue} from '../component/useConnectionValue.ts';
import type {BlockItem} from './Field.tsx';

const emptyAddons: readonly string[] = [];

function selectAddons(value: unknown): readonly string[] {
  return isStringArray(value) ? value : emptyAddons;
}

function selectString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

interface BlockAddonItemProps {
  conn: ClientConn;
  addonPath: string;
  name: string;
  funcModule: string;
  selected: boolean;
  onSelect: (addonPath: string) => void;
}

const BlockAddonItem = React.memo(function BlockAddonItem({
  conn,
  addonPath,
  name,
  funcModule,
  selected,
  onSelect,
}: BlockAddonItemProps) {
  const funcId = useConnectionValue(conn, `${addonPath}.#is`, selectString);
  const displayName = useConnectionValue(conn, `${addonPath}.#label`, selectString);
  const [desc, setDesc] = useState<FunctionDesc>(blankFuncDesc);

  useEffect(() => {
    if (!funcId) {
      setDesc(blankFuncDesc);
      return;
    }
    const onDesc = (nextDesc: FunctionDesc) => {
      setDesc(nextDesc || blankFuncDesc);
    };
    conn.watchDesc(funcId, getDescModule(funcId, funcModule), onDesc);
    return () => {
      conn.unwatchDesc(onDesc);
    };
  }, [conn, funcId, funcModule]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(addonPath);
    },
    [onSelect, addonPath]
  );

  const [colorStyle, icon] = getFuncStyleFromDesc(desc, conn);
  const label = getDisplayName(name.startsWith('#-') ? name.slice(2) : name, displayName);

  return (
    <BlockDropdown
      checkPolicy
      functionId={desc.id}
      conn={conn}
      path={addonPath}
      displayName={displayName}
      canApply={false}
      funcModule={funcModule}
    >
      <Tooltip title={label} mouseEnterDelay={0}>
        <div
          className={selected ? 'ticl-e-block-addon ticl-e-block-addon-selected' : 'ticl-e-block-addon'}
          style={colorStyle}
          data-addon={name}
          onMouseDown={stopPropagation}
          onDoubleClick={stopPropagation}
          onClick={handleClick}
        >
          <TIcon icon={icon} />
        </div>
      </Tooltip>
    </BlockDropdown>
  );
});

export const BlockAddons = React.memo(function BlockAddons({
  item,
  selectedAddon,
}: {
  item: BlockItem;
  selectedAddon: string | null;
}) {
  const addons = useConnectionValue(item.conn, `${item.path}.#addon`, selectAddons, true);
  const prevAddonsRef = useRef<readonly string[]>(emptyAddons);

  useEffect(() => {
    const prevAddons = prevAddonsRef.current;
    prevAddonsRef.current = addons;
    if (!selectedAddon) return;
    const prefix = `${item.path}.`;
    if (!selectedAddon.startsWith(prefix)) return;
    const name = selectedAddon.slice(prefix.length);
    if (prevAddons.includes(name) && !addons.includes(name)) {
      item.stage.clearAddonSelection(selectedAddon);
    }
  }, [addons, item, selectedAddon]);

  const handleSelect = useCallback(
    (addonPath: string) => {
      item.stage.selectAddon(addonPath);
      item.stage.focus();
    },
    [item]
  );

  if (!addons.length) return null;
  const funcModule = item.stage.getFuncModule();

  return (
    <div className="ticl-e-block-addons">
      {addons.map((name) => {
        const addonPath = `${item.path}.${name}`;
        return (
          <BlockAddonItem
            key={name}
            conn={item.conn}
            addonPath={addonPath}
            name={name}
            funcModule={funcModule}
            selected={selectedAddon === addonPath}
            onSelect={handleSelect}
          />
        );
      })}
    </div>
  );
});
