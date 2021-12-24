import {DataMap, getTailingNumber} from '../../core';
import {PropertyEditorProps, PropertyReorder} from './PropertyEditor';
import {DragState} from 'rc-dock';
import {deepEqual} from '../../core/util/Compare';

export const CustomGroupPropertyReorder: PropertyReorder = {
  getDragData(props: PropertyEditorProps): DataMap {
    let {paths, name, group, baseName} = props;
    let data: any = {paths, fromGroup: group};
    data.moveCustomField = baseName;
    data.moveGroupIndex = getTailingNumber(name);
    return data;
  },
  onDragOver(props: PropertyEditorProps, e: DragState): string {
    let {conn, paths, group, baseName, name, isCustom} = props;
    let moveFromPaths: string[] = DragState.getData('paths', conn.getBaseConn());
    if (moveFromPaths === paths) {
      let isLen = group != null && name.endsWith('[]');
      let fromGroup = DragState.getData('fromGroup', conn.getBaseConn());
      if (isCustom) {
        // move custom property
        let moveCustomField: string = DragState.getData('moveCustomField', conn.getBaseConn());

        if (moveCustomField != null) {
          let moveToField = baseName != null ? baseName : name;
          if (isLen) {
            moveToField = group;
            group = null;
          }

          // tslint:disable-next-line:triple-equals
          if (moveToField !== moveCustomField && group == fromGroup) {
            return 'tico-fas-exchange-alt';
          }
        }
      }
      if (group != null && !isLen && group === fromGroup) {
        // move group index
        let moveGroupIndex = DragState.getData('moveGroupIndex', conn.getBaseConn());
        let currentGroupIndex = getTailingNumber(name);
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
    let isLen = group != null && name.endsWith('[]');
    let fromGroup = DragState.getData('fromGroup', conn.getBaseConn());
    let moveFromPaths: string[] = DragState.getData('paths', conn.getBaseConn());
    if (moveFromPaths === paths) {
      if (isCustom) {
        // move custom property
        let moveCustomField: string = DragState.getData('moveCustomField', conn.getBaseConn());

        let moveToField = baseName != null ? baseName : name;
        if (isLen) {
          moveToField = group;
          group = null;
        }

        // tslint:disable-next-line:triple-equals
        if (moveToField !== moveCustomField && group == fromGroup) {
          for (let key of paths) {
            conn.moveCustomProp(key, moveCustomField, moveToField, fromGroup);
          }
          return;
        }
      }
      if (group != null && !isLen && group === fromGroup) {
        // move group index
        let moveGroupIndex = DragState.getData('moveGroupIndex', conn.getBaseConn());
        let currentGroupIndex = getTailingNumber(name);
        for (let key of paths) {
          conn.moveGroupProp(key, fromGroup, moveGroupIndex, currentGroupIndex);
        }
      }
    }
  },
};

export const GroupPropertyReorder: PropertyReorder = {
  getDragData(props: PropertyEditorProps): DataMap {
    let {paths, name, group, baseName, isCustom} = props;
    let data: any = {paths, fromGroup: group};
    data.moveGroupIndex = getTailingNumber(name);
    return data;
  },
  onDragOver: CustomGroupPropertyReorder.onDragOver,
  onDragDrop: CustomGroupPropertyReorder.onDragDrop,
};

export const CustomPropertyReorder: PropertyReorder = {
  getDragData(props: PropertyEditorProps): DataMap {
    let {paths, name, group, baseName} = props;
    let data: any = {paths};
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
    let {paths, name} = props;
    return {paths, moveOptionalField: name};
  },
  onDragOver(props: PropertyEditorProps, e: DragState): string {
    let {conn, paths, name} = props;
    let moveFromPaths: string[] = DragState.getData('paths', conn.getBaseConn());
    if (moveFromPaths === paths) {
      let moveOptionalField: string = DragState.getData('moveOptionalField', conn.getBaseConn());

      if (moveOptionalField && moveOptionalField !== name) {
        return 'tico-fas-exchange-alt';
      }
    }
    return null;
  },
  onDragDrop(props: PropertyEditorProps, e: DragState) {
    let {conn, paths, name} = props;
    let moveFromPaths: string[] = DragState.getData('paths', conn.getBaseConn());
    if (moveFromPaths === paths) {
      let moveOptionalField: string = DragState.getData('moveOptionalField', conn.getBaseConn());

      if (moveOptionalField && moveOptionalField !== name) {
        for (let key of paths) {
          conn.moveOptionalProp(key, moveOptionalField, name);
        }
      }
    }
  },
};
