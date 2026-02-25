// ChatIframe component tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ChatIframe } from './ChatIframe';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('ChatIframe', () => {
  const defaultProps = {
    url: 'https://example.com/chat',
  };

  beforeEach(() => {
    // Mock iframe
    HTMLIFrameElement.prototype.load = vi.fn();
  });

  describe('Rendering', () => {
    it('should render iframe with correct src', () => {
      render(<ChatIframe {...defaultProps} />);

      const iframe = document.querySelector('iframe');
      expect(iframe).toBeTruthy();
      expect(iframe?.getAttribute('src')).toBe('https://example.com/chat');
    });

    it('should have correct sandbox attributes', () => {
      render(<ChatIframe {...defaultProps} />);

      const iframe = document.querySelector('iframe');
      const sandbox = iframe?.getAttribute('sandbox');
      expect(sandbox).toContain('allow-same-origin');
      expect(sandbox).toContain('allow-scripts');
      expect(sandbox).toContain('allow-forms');
      expect(sandbox).toContain('allow-popups');
      expect(sandbox).toContain('allow-modals');
    });

    it('should have correct allow permissions', () => {
      render(<ChatIframe {...defaultProps} />);

      const iframe = document.querySelector('iframe');
      const allow = iframe?.getAttribute('allow');
      expect(allow).toContain('microphone');
      expect(allow).toContain('camera');
      expect(allow).toContain('clipboard-write');
    });

    it('should have correct title attribute', () => {
      render(<ChatIframe {...defaultProps} />);

      const iframe = document.querySelector('iframe');
      expect(iframe?.getAttribute('title')).toBe('OpenClaw Chat');
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      render(<ChatIframe {...defaultProps} />);

      expect(screen.getByText(/Loading Chat/i)).toBeTruthy();
    });

    it('should hide loading spinner on load', async () => {
      render(<ChatIframe {...defaultProps} />);

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;

      // Simulate iframe load
      iframe.dispatchEvent(new Event('load'));

      await waitFor(() => {
        expect(screen.queryByText(/Loading Chat/i)).toBeFalsy();
      });
    });

    it('should show loading spinner with correct text', () => {
      render(<ChatIframe {...defaultProps} />);

      expect(screen.getByText('Loading...')).toBeTruthy();
    });
  });

  describe('Error State', () => {
    it('should show error message on load error', async () => {
      render(<ChatIframe {...defaultProps} />);

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;

      // Simulate iframe error
      iframe.dispatchEvent(new Event('error'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to load Chat/i)).toBeTruthy();
      });
    });

    it('should show helpful error message', async () => {
      render(<ChatIframe {...defaultProps} />);

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;

      iframe.dispatchEvent(new Event('error'));

      await waitFor(() => {
        expect(screen.getByText(/Make sure the instance URL is accessible/i)).toBeTruthy();
      });
    });
  });

  describe('Callbacks', () => {
    it('should call onLoad callback when iframe loads', async () => {
      const onLoad = vi.fn();
      render(<ChatIframe {...defaultProps} onLoad={onLoad} />);

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;

      iframe.dispatchEvent(new Event('load'));

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onError callback when iframe errors', async () => {
      const onError = vi.fn();
      render(<ChatIframe {...defaultProps} onError={onError} />);

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;

      iframe.dispatchEvent(new Event('error'));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Styling', () => {
    it('should have full width and height', () => {
      render(<ChatIframe {...defaultProps} />);

      const iframe = document.querySelector('iframe');
      expect(iframe?.classList.contains('w-full')).toBe(true);
      expect(iframe?.classList.contains('h-full')).toBe(true);
    });

    it('should have no border', () => {
      render(<ChatIframe {...defaultProps} />);

      const iframe = document.querySelector('iframe');
      expect(iframe?.getAttribute('class')).toContain('border-0');
    });
  });

  describe('Different URLs', () => {
    it('should work with http URLs', () => {
      render(<ChatIframe url="http://example.com/chat" />);

      const iframe = document.querySelector('iframe');
      expect(iframe?.getAttribute('src')).toBe('http://example.com/chat');
    });

    it('should work with https URLs', () => {
      render(<ChatIframe url="https://example.com/chat" />);

      const iframe = document.querySelector('iframe');
      expect(iframe?.getAttribute('src')).toBe('https://example.com/chat');
    });

    it('should work with port in URL', () => {
      render(<ChatIframe url="https://example.com:8443/chat" />);

      const iframe = document.querySelector('iframe');
      expect(iframe?.getAttribute('src')).toBe('https://example.com:8443/chat');
    });
  });
});
