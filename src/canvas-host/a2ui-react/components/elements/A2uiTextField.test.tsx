/**
 * A2uiTextField Component Tests
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { A2uiTextField } from './A2uiTextField';
import { renderWithProviders } from '../../test/testutils';

describe('A2uiTextField', () => {
  it('should render input field', () => {
    renderWithProviders(
      <A2uiTextField id="field1" label={{ literalString: 'Name' }} placeholder={{ literalString: 'Enter name' }} />
    );

    const input = screen.getByLabelText('Name');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Enter name');
  });

  it('should render password input when secret is true', () => {
    renderWithProviders(
      <A2uiTextField id="field1" label={{ literalString: 'Password' }} secret={true} />
    );

    const input = screen.getByLabelText('Password');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
  });

  it('should render multiline textarea', () => {
    renderWithProviders(
      <A2uiTextField id="field1" label={{ literalString: 'Bio' }} multiline={true} />
    );

    const textarea = screen.getByLabelText('Bio');
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
  });

  it('should be disabled when disabled prop is true', () => {
    renderWithProviders(
      <A2uiTextField id="field1" label={{ literalString: 'Name' }} disabled={true} />
    );

    const input = screen.getByLabelText('Name');
    expect(input).toBeDisabled();
  });

  it('should display initial value', () => {
    renderWithProviders(
      <A2uiTextField id="field1" label={{ literalString: 'Name' }} value={{ literalString: 'Bob' }} />
    );

    const input = screen.getByLabelText('Name') as HTMLInputElement;
    expect(input.value).toBe('Bob');
  });

  it('should update value on change', () => {
    renderWithProviders(
      <A2uiTextField id="field1" label={{ literalString: 'Name' }} />
    );

    const input = screen.getByLabelText('Name') as HTMLInputElement;
    input.value = 'Alice';

    const event = new Event('input', { bubbles: true });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });
    input.dispatchEvent(event);

    expect(input.value).toBe('Alice');
  });
});
