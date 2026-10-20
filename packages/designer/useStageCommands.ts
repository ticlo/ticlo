import {useMemo, type RefObject} from 'react';
import {decode, encode, isStringArray, type DataMap} from '@ticlo/core';
import {isSavedBlock} from '@ticlo/core/util/DataTypes.ts';
import {Namespace} from '@ticlo/core/block/Namespace.ts';
import {notification} from 'antd';
import type {TicloStageCommands} from '@ticlo/editor/component/LayoutContext.ts';
import {requestCallbacks} from '@ticlo/editor/util/RequestCallbacks.ts';
import type {DesignerSelection, DesignerStageContextValue} from './DesignerContext.tsx';

type CommandContext = Pick<DesignerStageContextValue, 'conn' | 'basePath' | 'flow' | 'main' | 'designMode' | 'select'>;

export function useStageCommands(
  {conn, basePath, flow, main, designMode, select}: CommandContext,
  selectionRef: RefObject<DesignerSelection>,
  onSave?: () => void
) {
  return useMemo<TicloStageCommands>(() => {
    const selectedRoots = () => {
      const blocks = selectionRef.current.blocks.filter((block) => !block.isDestroyed() && block._flow === flow);
      return blocks.filter(
        (block) => !blocks.some((other) => other !== block && block.getFullPath().startsWith(`${other.getFullPath()}.`))
      );
    };
    const getDesc = (id: unknown) =>
      typeof id === 'string' ? Namespace.getFunctions(id, flow)?.listen(id, null)?.getValue()?.desc : undefined;
    return {
      save() {
        if (!flow || !conn.getEditPolicyView().can({cmd: 'applyFlowChange', path: basePath})) return false;
        if (onSave) onSave();
        else conn.applyFlowChange(basePath, undefined, requestCallbacks);
        return true;
      },
      undo() {
        if (!flow || !conn.getEditPolicyView().can({cmd: 'undo', path: basePath})) return false;
        flow.undo();
        return true;
      },
      redo() {
        if (!flow || !conn.getEditPolicyView().can({cmd: 'redo', path: basePath})) return false;
        flow.redo();
        return true;
      },
      deleteSelection() {
        if (!designMode || !flow) return false;
        const blocks = selectedRoots();
        if (!blocks.length || !blocks.every((block) => conn.getEditPolicyView().canDeleteBlock(block.getFullPath())))
          return false;
        for (const block of blocks) {
          const parentPath = block.getParent().getFullPath();
          conn.deleteBlock(block.getFullPath(), {
            ...requestCallbacks,
            onDone: () => conn.childrenChangeStream().dispatch({path: parentPath}),
          });
        }
        return true;
      },
      copy() {
        if (!designMode || !flow) return false;
        const blocks = selectedRoots();
        const parent = blocks[0]?.getParent();
        if (!parent || blocks.some((block) => block.getParent() !== parent)) return false;
        const path = parent.getFullPath();
        const props = blocks.map((block) => block.getName());
        if (!conn.getEditPolicyView().can({cmd: 'copy', path, props})) return false;
        void (async () => {
          try {
            const data = await conn.copy(path, props);
            await navigator.clipboard.writeText(encode(data.value));
          } catch (error) {
            notification.error({title: 'Failed to copy', description: String(error)});
          }
        })();
        return true;
      },
      paste(event) {
        if (!designMode || !main) return false;
        const selected = selectionRef.current.blocks.at(-1);
        const parent = selected && selected !== main ? selected.getParent() : main;
        if (!parent || parent._flow !== flow || parent.getValue('@d-seal')) return false;
        const order = parent.getValue('#order') ?? [];
        if (!isStringArray(order) || parent.getProperty('#order', false)?._bindingSource) return false;
        const path = parent.getFullPath();
        const policy = conn.getEditPolicyView();
        if (!policy.canWriteField(`${path}.#order`)) return false;
        let data: DataMap;
        try {
          data = decode(event.clipboardData.getData('Text'));
          const tags = getDesc(parent.getValue('#is'))?.childrenTags;
          const entries = Object.entries(data).filter(([name]) => name !== '#_copy_from');
          if (
            !entries.length ||
            entries.some(
              ([, value]) => !isSavedBlock(value) || !getDesc(value['#is'])?.tags?.some((tag) => tags?.includes(tag))
            )
          )
            throw new Error('Invalid input');
        } catch (error) {
          notification.error({title: 'Failed to paste', description: String(error)});
          return true;
        }
        if (!policy.can({cmd: 'paste', path, data, resolve: 'rename'})) return false;
        void (async () => {
          try {
            const response = await conn.paste(path, data, 'rename');
            if (parent.isDestroyed()) return;
            const names = response.pasted as string[];
            const currentOrder = parent.getValue('#order') ?? [];
            if (!isStringArray(currentOrder) || parent.getProperty('#order', false)?._bindingSource) return;
            await conn.setValue(`${path}.#order`, [...currentOrder, ...names], true);
            conn.childrenChangeStream().dispatch({path, showNode: true});
            select(names.map((name) => `${path}.${name}`));
          } catch (error) {
            notification.error({title: 'Failed to paste', description: String(error)});
          }
        })();
        return true;
      },
    };
  }, [conn, basePath, flow, main, designMode, select, selectionRef, onSave]);
}
