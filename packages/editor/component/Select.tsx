import React, {useMemo} from 'react';
import {Button, MenuItem} from '@blueprintjs/core';
import {Select as BlueprintSelect, MultiSelect as BlueprintMultiSelect, type ItemRenderer} from '@blueprintjs/select';

export interface SelectOption<T = string> {
  value: T;
  label?: React.ReactNode;
}

export interface SelectProps<T = string> {
  value?: T;
  onChange?: (value: T) => void;
  placeholder?: React.ReactNode;
  disabled?: boolean;
  matchTargetWidth?: boolean;
  options: Array<SelectOption<T>>;
}

export function Select<T = string>({
  value,
  onChange,
  placeholder,
  disabled,
  options,
  matchTargetWidth = true,
}: SelectProps<T>): React.ReactElement {
  const {items, renderMenuItem, valueLabelMap} = useMemo(() => {
    const valueLabelMap = new Map<T, React.ReactNode>();
    const items: T[] = [];
    options.forEach((opt) => {
      valueLabelMap.set(opt.value, opt.label ?? String(opt.value));
      items.push(opt.value);
    });

    const renderMenuItem: ItemRenderer<T> = (item, {handleClick, modifiers}) => {
      if (!modifiers.matchesPredicate) {
        return null;
      }
      return (
        <MenuItem
          key={String(item)}
          active={modifiers.active}
          onClick={handleClick}
          text={valueLabelMap.get(item) ?? String(item)}
        />
      );
    };

    return {
      items,
      renderMenuItem,
      valueLabelMap,
    };
  }, [options]);

  return (
    <BlueprintSelect<T>
      activeItem={value}
      items={items}
      itemRenderer={renderMenuItem}
      filterable={false}
      onItemSelect={onChange}
      popoverProps={{matchTargetWidth, minimal: true}}
      disabled={disabled}
    >
      <Button fill size="small" endIcon="caret-down" disabled={disabled}>
        {valueLabelMap.get(value) ?? placeholder ?? ' '}
      </Button>
    </BlueprintSelect>
  );
}

export interface MultiSelectProps<T = string> {
  values?: T[];
  onChange?: (value: T[]) => void;
  placeholder?: string;
  disabled?: boolean;
  matchTargetWidth?: boolean;
  options: Array<SelectOption<T>>;
}

export function MultiSelect<T = string>({
  values = [],
  onChange,
  placeholder,
  disabled,
  options,
  matchTargetWidth = true,
}: MultiSelectProps<T>): React.ReactElement {
  const {items, renderMenuItem, valueLabelMap} = useMemo(() => {
    const valueLabelMap = new Map<T, React.ReactNode>();
    const items: T[] = [];
    options.forEach((opt) => {
      const label = opt.label ?? String(opt.value);
      valueLabelMap.set(opt.value, label);
      items.push(opt.value);
    });

    const renderMenuItem: ItemRenderer<T> = (item, {handleClick, modifiers}) => {
      if (!modifiers.matchesPredicate) {
        return null;
      }
      return (
        <MenuItem
          key={String(item)}
          active={modifiers.active}
          onClick={handleClick}
          text={valueLabelMap.get(item) ?? String(item)}
        />
      );
    };

    return {
      items,
      renderMenuItem,
      valueLabelMap,
    };
  }, [options]);

  const handleItemSelect = (item: T) => {
    if (disabled) {
      return;
    }
    const exists = values.some((selected) => Object.is(selected, item));
    const next = exists ? values.filter((selected) => !Object.is(selected, item)) : [...values, item];
    onChange?.(next);
  };

  const handleTagRemove = (_tag: React.ReactNode, index: number) => {
    if (disabled || index < 0 || index >= values.length) {
      return;
    }
    const next = values.filter((_, idx) => idx !== index);
    onChange?.(next);
  };

  return (
    <BlueprintMultiSelect<T>
      items={items}
      itemRenderer={renderMenuItem}
      selectedItems={values}
      tagRenderer={(item) => valueLabelMap.get(item) ?? String(item)}
      onItemSelect={handleItemSelect}
      tagInputProps={{
        disabled,
        onRemove: handleTagRemove,
      }}
      placeholder={placeholder}
      popoverProps={{matchTargetWidth, minimal: true}}
      disabled={disabled}
      resetOnSelect={false}
    />
  );
}
