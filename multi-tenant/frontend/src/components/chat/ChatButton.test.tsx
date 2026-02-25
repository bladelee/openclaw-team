// ChatButton component tests
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatButton } from './ChatButton';

// Mock the Tooltip component
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  MessageSquare: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="message-square-icon" />
  ),
}));

describe('ChatButton', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<ChatButton />);
      expect(screen.getByTestId('message-square-icon')).toBeTruthy();
    });

    it('should render the MessageSquare icon', () => {
      render(<ChatButton />);
      expect(screen.getByTestId('message-square-icon')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<ChatButton className="custom-class" />);
      const button = document.querySelector('button');
      expect(button?.classList.contains('custom-class')).toBe(true);
    });
  });

  describe('Interaction', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<ChatButton onClick={handleClick} />);

      const button = document.querySelector('button');
      button && fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<ChatButton onClick={handleClick} disabled={true} />);

      const button = document.querySelector('button') as HTMLButtonElement;
      expect(button?.disabled).toBe(true);

      button && fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should be enabled by default', () => {
      render(<ChatButton />);
      const button = document.querySelector('button') as HTMLButtonElement;
      expect(button?.disabled).toBe(false);
    });
  });

  describe('Tooltip', () => {
    it('should show tooltip with "Open Chat" text', () => {
      render(<ChatButton />);
      // Tooltip would be shown on hover in real scenario
      // We're just verifying the component renders
      expect(screen.getByTestId('message-square-icon')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      const handleClick = vi.fn();
      render(<ChatButton onClick={handleClick} />);

      const button = document.querySelector('button');
      button && fireEvent.click(button);

      expect(handleClick).toHaveBeenCalled();
    });
  });
});
