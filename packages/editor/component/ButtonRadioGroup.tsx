import React, {useMemo, type FC} from 'react';
import {Button, ButtonGroup, type ButtonGroupProps, type ButtonProps} from '@blueprintjs/core';
import {on} from 'events';

export interface ButtonRadioGroupProps extends Omit<ButtonGroupProps, 'children' | 'onChange'> {
  options: (ButtonProps & {label: string})[];
  defaultValue?: string | number;
  value?: string | number;
  onChange?: (value: string | number) => void;
}

const ButtonRadioGroup: FC<ButtonRadioGroupProps> = ({options, value, defaultValue, onChange, ...props}) => {
  const buttons = useMemo(
    () =>
      options.map((option, index) => {
        const {onClick, label, ...others} = option;
        const onButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(e);
          // todo: handle value change of the ButtonRadioGroup itself.
        };
        return (
          <Button key={option.value as string | number} {...others} onClick={onButtonClick}>
            {label ?? option.value}
          </Button>
        );
      }),
    [options]
  );

  return <ButtonGroup {...props}>{buttons}</ButtonGroup>;
};

export default ButtonRadioGroup;
