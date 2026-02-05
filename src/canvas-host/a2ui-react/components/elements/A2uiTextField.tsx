/**
 * A2UI TextField Component
 * Text input field with label and validation
 */

import React, { useState, useCallback } from 'react';
import { useA2uiTheme } from '../../context/A2uiThemeContext';

interface TextFieldProps {
  id: string;
  label?: {
    literalString?: string;
  };
  placeholder?: {
    literalString?: string;
  };
  value?: {
    literalString?: string;
    path?: string;
  };
  disabled?: boolean;
  secret?: boolean;
  multiline?: boolean;
  style?: Record<string, unknown>;
}

export const A2uiTextField: React.FC<TextFieldProps> = ({
  id,
  label,
  placeholder,
  value,
  disabled = false,
  secret = false,
  multiline = false,
  style
}) => {
  const { theme } = useA2uiTheme();
  const [localValue, setLocalValue] = useState(
    value?.literalString || value?.path || ''
  );

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
  }, []);

  // Resolve label
  const labelText = label?.literalString;

  // Resolve placeholder
  const placeholderText = placeholder?.literalString;

  // Build input styles
  const inputStyle: React.CSSProperties = {
    ...theme.components.TextField,
    ...style
  };

  const inputElement = multiline ? (
    <textarea
      id={id}
      className="a2ui-textfield a2ui-textfield-multiline"
      value={localValue}
      onChange={handleChange}
      placeholder={placeholderText}
      disabled={disabled}
      rows={4}
      style={inputStyle}
    />
  ) : (
    <input
      id={id}
      className="a2ui-textfield"
      type={secret ? 'password' : 'text'}
      value={localValue}
      onChange={handleChange}
      placeholder={placeholderText}
      disabled={disabled}
      style={inputStyle}
    />
  );

  if (labelText) {
    return (
      <div className="a2ui-textfield-wrapper">
        <label className="a2ui-textfield-label" htmlFor={id}>
          {labelText}
        </label>
        {inputElement}
      </div>
    );
  }

  return inputElement;
};
