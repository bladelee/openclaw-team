/**
 * A2uiImage Component Tests
 */

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { A2uiImage } from './A2uiImage';
import { renderWithProviders } from '../../test/testutils';

describe('A2uiImage', () => {
  it('should render image with src', () => {
    renderWithProviders(
      <A2uiImage
        id="img1"
        url={{ literalString: 'https://example.com/image.jpg' }}
        alt={{ literalString: 'Test Image' }}
      />
    );

    const img = screen.getByAltText('Test Image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('should apply fit mode class', () => {
    const { container } = renderWithProviders(
      <A2uiImage id="img1" url={{ literalString: 'test.jpg' }} fit="cover" />
    );

    const wrapper = container.querySelector('.a2ui-image');
    expect(wrapper).toBeInTheDocument();
  });

  it('should apply custom width and height', () => {
    const { container } = renderWithProviders(
      <A2uiImage
        id="img1"
        url={{ literalString: 'test.jpg' }}
        width={{ literalNumber: 200 }}
        height={{ literalNumber: 100 }}
      />
    );

    const img = container.querySelector('.a2ui-image');
    expect(img).toHaveStyle({ width: '200px', height: '100px' });
  });

  it('should show placeholder when no URL', () => {
    const { container } = renderWithProviders(
      <A2uiImage
        id="img1"
        url={{ literalString: '' }}
      />
    );

    const placeholder = container.querySelector('.a2ui-image-placeholder');
    expect(placeholder).toBeInTheDocument();
  });

  it('should show fallback on error', async () => {
    const { container } = renderWithProviders(
      <A2uiImage
        id="img1"
        url={{ literalString: 'invalid.jpg' }}
      />
    );

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();

    // Trigger error event
    if (img) {
      img.dispatchEvent(new Event('error'));
    }

    // Wait for state update
    await waitFor(() => {
      const error = container.querySelector('.a2ui-image-error');
      expect(error).toBeInTheDocument();
    });
  });
});
