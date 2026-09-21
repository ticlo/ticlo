import {DataMap, getTailingNumber} from '@ticlo/core';
import {PropertyEditorProps, PropertyReorder} from './PropertyEditor.tsx';
import {DragState} from 'rc-dock';

function canReorder({conn, paths}: PropertyEditorProps, cmd: string) {
  const policy = conn.getEditPolicyView();
  return paths.every((path) => policy.can({cmd, path}));
}

export const CustomGroupPropertyReorder: PropertyReorder = {
  getDragData(props: PropertyEditorProps): DataMap {
    const {paths, name, group, baseName} = props;
    const data: DataMap = {paths, fromGroup: group};
    if (canReorder(props, 'moveCustomProp')) data.moveCustomField = baseName;
    if (canReorder(props, 'moveGroupProp')) data.moveGroupIndex = getTailingNumber(name);
    return data.moveCustomField != null || data.moveGroupIndex != null ? data : null;
  },
  onDragOver(props: PropertyEditorProps, e: DragState): string {
    let {conn, paths, group, baseName, name, isCustom} = props;
    const moveFromPaths: string[] = DragState.getData('paths', conn.getBaseConn());
    if (moveFromPaths === paths) {
      const isLen = group != null && name.endsWith('[]');
      const fromGroup = DragState.getData('fromGroup', conn.getBaseConn());
      if (isCustom) {
        // move custom property
        const moveCustomField: string = DragState.getData('moveCustomField', conn.getBaseConn());

        if (moveCustomField != null) {
          let moveToField = baseName != null ? baseName : name;
          if (isLen) {
            moveToField = group;
            group = null;
          }

          if (moveToField !== moveCustomField && group == fromGroup) {
            return 'tico-fas-exchange-alt';
          }
        }
      }
      if (group != null && !isLen && group === fromGroup) {
        // move group index
        const moveGroupIndex = DragState.getData('moveGroupIndex', conn.getBaseConn());
        const currentGroupIndex = getTailingNumber(name);
        if (moveGroupIndex != null && moveGroupIndex !== currentGroupIndex) {
          return 'tico-fas-random';
        }
      }
    }
    return null;
  },
  onDragDrop(props: PropertyEditorProps, e: DragState): void {
    let {conn, paths, group, baseName, name, isCustom} = props;
    // check reorder drag with right click
    const isLen = group != null && name.endsWith('[]');
    const fromGroup = DragState.getData('fromGroup', conn.getBaseConn());
    const moveFromPaths: string[] = DragState.getData('paths', conn.getBaseConn());
    if (moveFromPaths === paths) {
      if (isCustom) {
        // move custom property
        const moveCustomField: string = DragState.getData('moveCustomField', conn.getBaseConn());

        let moveToField = baseName != null ? baseName : name;
        if (isLen) {
          moveToField = group;
          group = null;
        }

        if (moveCustomField != null && moveToField !== moveCustomField && group == fromGroup) {
          for (const key of paths) {
            conn.moveCustomProp(key, moveCustomField, moveToField, fromGroup);
          }
          return;
        }
      }
      if (group != null && !isLen && group === fromGroup) {
        // move group index
        const moveGroupIndex = DragState.getData('moveGroupIndex', conn.getBaseConn());
        const currentGroupIndex = getTailingNumber(name);
        if (moveGroupIndex != null && moveGroupIndex !== currentGroupIndex) {
          for (const key of paths) {
            conn.moveGroupProp(key, fromGroup, moveGroupIndex, currentGroupIndex);
          }
        }
      }
    }
  },
};

export const GroupPropertyReorder: PropertyReorder = {
  getDragData(props: PropertyEditorProps): DataMap {
    if (!canReorder(props, 'moveGroupProp')) return null;
    const {paths, name, group} = props;
    return {paths, fromGroup: group, moveGroupIndex: getTailingNumber(name)};
  },
  onDragOver: CustomGroupPropertyReorder.onDragOver,
  onDragDrop: CustomGroupPropertyReorder.onDragDrop,
};

export const CustomPropertyReorder: PropertyReorder = {
  getDragData(props: PropertyEditorProps): DataMap {
    if (!canReorder(props, 'moveCustomProp')) return null;
    const {paths, name, group, baseName} = props;
    // move custom property
    let moveCustomField = baseName != null ? baseName : name;
    if (group != null && name.endsWith('[]')) {
      moveCustomField = group;
    }
    return {paths, moveCustomField};
  },
  onDragOver: CustomGroupPropertyReorder.onDragOver,
  onDragDrop: CustomGroupPropertyReorder.onDragDrop,
};

export const OptionalPropertyReorder: PropertyReorder = {
  getDragData(props: PropertyEditorProps): DataMap {
    if (!canReorder(props, 'moveOptionalProp')) return null;
    const {paths, name} = props;
    return {paths, moveOptionalField: name};
  },
  onDragOver(props: PropertyEditorProps, e: DragState): string {
    const {conn, paths, name} = props;
    const moveFromPaths: string[] = DragState.getData('paths', conn.getBaseConn());
    if (moveFromPaths === paths) {
      const moveOptionalField: string = DragState.getData('moveOptionalField', conn.getBaseConn());

      if (moveOptionalField && moveOptionalField !== name) {
        return 'tico-fas-exchange-alt';
      }
    }
    return null;
  },
  onDragDrop(props: PropertyEditorProps, e: DragState) {
    const {conn, paths, name} = props;
    const moveFromPaths: string[] = DragState.getData('paths', conn.getBaseConn());
    if (moveFromPaths === paths) {
      const moveOptionalField: string = DragState.getData('moveOptionalField', conn.getBaseConn());

      if (moveOptionalField && moveOptionalField !== name) {
        for (const key of paths) {
          conn.moveOptionalProp(key, moveOptionalField, name);
        }
      }
    }
  },
};
