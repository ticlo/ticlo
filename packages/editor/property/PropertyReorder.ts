import {DataMap, getTailingNumber} from '@ticlo/core';
import {PropertyEditorProps, PropertyReorder} from './PropertyEditor.js';
import {DragState} from 'rc-dock';
import {deepEqual} from '@ticlo/core/util/Compare.js';

export const CustomGroupPropertyReorder: PropertyReorder = {
  getDragData(props: PropertyEditorProps): DataMap {
    const {paths, name, group, baseName} = props;
    const data: any = {paths, fromGroup: group};
    data.moveCustomField = baseName;
    data.moveGroupIndex = getTailingNumber(name);
    return data;
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
        if (moveGroupIndex !== currentGroupIndex) {
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

        if (moveToField !== moveCustomField && group == fromGroup) {
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
        for (const key of paths) {
          conn.moveGroupProp(key, fromGroup, moveGroupIndex, currentGroupIndex);
        }
      }
    }
  },
};

export const GroupPropertyReorder: PropertyReorder = {
  getDragData(props: PropertyEditorProps): DataMap {
    const {paths, name, group, baseName, isCustom} = props;
    const data: any = {paths, fromGroup: group};
    data.moveGroupIndex = getTailingNumber(name);
    return data;
  },
  onDragOver: CustomGroupPropertyReorder.onDragOver,
  onDragDrop: CustomGroupPropertyReorder.onDragDrop,
};

export const CustomPropertyReorder: PropertyReorder = {
  getDragData(props: PropertyEditorProps): DataMap {
    const {paths, name, group, baseName} = props;
    const data: any = {paths};
    // move custom property
    let moveCustomField = baseName != null ? baseName : name;
    if (group != null && name.endsWith('[]')) {
      moveCustomField = group;
    }
    data.moveCustomField = moveCustomField;

    return data;
  },
  onDragOver: CustomGroupPropertyReorder.onDragOver,
  onDragDrop: CustomGroupPropertyReorder.onDragDrop,
};

export const OptionalPropertyReorder: PropertyReorder = {
  getDragData(props: PropertyEditorProps): DataMap {
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
