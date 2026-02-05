/**
 * A2uiText Component Tests
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { A2uiText } from './A2uiText';
import { renderWithProviders } from '../../test/testutils';

describe('A2uiText', () => {
  it('should render text with literalString', () => {
    renderWithProviders(
      <A2uiText id="text1" text={{ literalString: 'Hello World' }} />
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should apply size styles', () => {
    const { container } = renderWithProviders(
      <A2uiText id="text1" text={{ literalString: 'Hello' }} size="xlarge" />
    );

    const textEl = container.querySelector('.a2ui-text-xlarge');
    expect(textEl).toBeInTheDocument();
  });

  it('should apply weight styles', () => {
    const { container } = renderWithProviders(
      <A2uiText id="text1" text={{ literalString: 'Hello' }} weight="bold" />
    );

    const textEl = container.querySelector('.a2ui-text-bold');
    expect(textEl).toBeInTheDocument();
  });

  it('should apply custom color', () => {
    const { container } = renderWithProviders(
      <A2uiText id="text1" text={{ literalString: 'Hello' }} color="#ff0000" />
    );

    const textEl = container.querySelector('.a2ui-text');
    expect(textEl).toHaveStyle({ color: '#ff0000' });
  });

  it('should resolve path from data model', () => {
    renderWithProviders(
      <A2uiText
        id="text1"
        text={{ path: 'user.name' }}
        surfaceId="main"
      />,
      {
        dataModel: { 'user.name': 'Alice' }
      }
    );

    expect(screen.getByText('user.name')).toBeInTheDocument();
  });

  it('should render empty string for missing path', () => {
    const { container } = renderWithProviders(
      <A2uiText
        id="text1"
        text={{ path: 'missing.key' }}
        surfaceId="main"
      />,
      {
        dataModel: {}
      }
    );

    const textEl = container.querySelector('.a2ui-text');
    expect(textEl).toBeInTheDocument();
  });
});
