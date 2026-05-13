import { Button, InputGroup } from '@blueprintjs/core';
import type { CSSProperties } from 'react';

interface FilterInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: CSSProperties;
}

/**
 * Search input with a clear button on the right.
 * @param props - Component props.
 */
export function FilterInput({
  value,
  onChange,
  placeholder = 'Filter...',
  style,
}: FilterInputProps) {
  return (
    <InputGroup
      leftIcon="search"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={style}
      rightElement={
        value ? (
          <Button icon="cross" variant="minimal" onClick={() => onChange('')} />
        ) : undefined
      }
    />
  );
}
