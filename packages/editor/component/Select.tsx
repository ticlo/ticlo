import React, {useMemo} from 'react';
import {Button, MenuItem} from '@blueprintjs/core';
import {Select as BlueprintSelect, type ItemRenderer} from '@blueprintjs/select';

interface SelectOption {
  value: string;
  label: React.ReactNode;
}

export interface SelectProps {
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: React.ReactNode;
  disabled?: boolean;
  options: SelectOption[];
}

export const Select: React.FC<SelectProps> = ({value, onChange, placeholder, disabled, options}) => {
  const {items, renderMenuItem, valueLabelMap} = useMemo(() => {
    const valueLabelMap: Record<string, React.ReactNode> = {};
    const items: string[] = [];
    options.forEach((opt) => {
      valueLabelMap[opt.value] = opt.label;
      items.push(opt.value);
    });

    const renderMenuItem: ItemRenderer<string> = (item, {handleClick, modifiers}) => {
      if (!modifiers.matchesPredicate) {
        return null;
      }
      return <MenuItem key={item} active={modifiers.active} onClick={handleClick} text={valueLabelMap[item]} />;
    };

    return {
      items,
      renderMenuItem,
      valueLabelMap,
    };
  }, [options]);

  return (
    <BlueprintSelect<string>
      activeItem={value}
      items={items}
      itemRenderer={renderMenuItem}
      filterable={false}
      onItemSelect={onChange}
      popoverProps={{matchTargetWidth: true, minimal: true}}
      disabled={disabled}
    >
      <Button fill size="small" endIcon="caret-down" disabled={disabled}>
        {valueLabelMap[value] ?? placeholder}
      </Button>
    </BlueprintSelect>
  );
};
