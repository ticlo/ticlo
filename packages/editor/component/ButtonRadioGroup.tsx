import React, {ReactNode, useMemo, type FC} from 'react';
import {Button, ButtonGroup, Tooltip, type ButtonGroupProps, type ButtonProps} from '@blueprintjs/core';

export type ButtonRadioOption = ButtonProps & {value: string | number; label?: string | ReactNode; tooltip?: string};

export interface ButtonRadioGroupProps extends Omit<ButtonGroupProps, 'children' | 'onChange'> {
  options: ButtonRadioOption[];
  defaultValue?: string | number;
  value?: string | number;
  disabled?: boolean;
  onChange?: (value: string | number) => void;
}

export const ButtonRadioGroup: FC<ButtonRadioGroupProps> = ({
  options,
  value,
  defaultValue,
  disabled,
  onChange,
  ...props
}) => {
  const [internalValue, setInternalValue] = React.useState<string | number | undefined>(defaultValue);
  const overriddenValue = value !== undefined ? value : internalValue;

  const buttons = useMemo(
    () =>
      options.map((option, index) => {
        const {onClick, label, tooltip, value: optionValue, ...others} = option;
        const selected = overriddenValue === optionValue;

        const onButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(e);
          if (overriddenValue !== optionValue) {
            if (value === undefined) {
              // uncontrolled mode
              setInternalValue(optionValue);
            }
            onChange?.(optionValue);
          }
        };
        // If no label provided, and tooltip and icon are not set, use option value as label
        const resolvedLabel = label ?? (tooltip || others.icon ? undefined : optionValue);
        const btn = (
          <Button
            key={option.value as string | number}
            {...others}
            intent={selected ? 'primary' : undefined}
            variant="outlined"
            onClick={onButtonClick}
            disabled={disabled}
          >
            {resolvedLabel}
          </Button>
        );
        if (tooltip) {
          return (
            <Tooltip key={option.value as string | number} placement="top" content={tooltip}>
              {btn}
            </Tooltip>
          );
        }
        return btn;
      }),
    [options, overriddenValue, disabled, value, onChange]
  );

  return (
    <ButtonGroup size="small" {...props}>
      {buttons}
    </ButtonGroup>
  );
};

export default ButtonRadioGroup;
