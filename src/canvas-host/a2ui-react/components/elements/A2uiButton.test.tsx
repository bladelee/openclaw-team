/**
 * A2uiButton Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { A2uiButton } from './A2uiButton';
import { renderWithProviders } from '../../test/testutils';

// Mock bridge adapter
const mockPostMessage = vi.fn().mockResolvedValue({ ok: true });

vi.mock('../../services/bridgeAdapter', () => ({
  getBridgeAdapter: () => ({
    postMessage: mockPostMessage
  })
}));

describe('A2uiButton', () => {
  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  it('should render button text', () => {
    renderWithProviders(
      <A2uiButton
        id="test-btn"
        text="Click Me"
        action={{ name: 'test', surfaceId: 'main', context: [] }}
      />
    );

    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    renderWithProviders(
      <A2uiButton
        id="test-btn"
        text="Click Me"
        action={{ name: 'test', surfaceId: 'main', context: [] }}
        disabled={true}
      />
    );

    const button = screen.getByText('Click Me');
    expect(button).toBeDisabled();
  });

  it('should trigger action on click', async () => {
    renderWithProviders(
      <A2uiButton
        id="test-btn"
        text="Click Me"
        action={{ name: 'test_action', surfaceId: 'main', context: [] }}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          name: 'test_action',
          surfaceId: 'main'
        })
      );
    });
  });

  it('should not trigger action when disabled', () => {
    renderWithProviders(
      <A2uiButton
        id="test-btn"
        text="Click Me"
        action={{ name: 'test', surfaceId: 'main', context: [] }}
        disabled={true}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockPostMessage).not.toHaveBeenCalled();
  });
});
