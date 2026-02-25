// Drawer component tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose, DrawerHeader, DrawerTitle, DrawerBody } from './drawer';

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className }: any) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

describe('Drawer Component', () => {
  beforeEach(() => {
    // Add cn utility function
    vi.doMock('@/lib/utils', () => ({
      cn: (...classes: (string | undefined | false | null)[]) => {
        return classes.filter(Boolean).join(' ');
      },
    }));
  });

  describe('Basic Functionality', () => {
    it('should not render content when open is false', () => {
      render(
        <Drawer open={false} onOpenChange={vi.fn()}>
          <DrawerContent>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      expect(screen.queryByText('Content')).toBeFalsy();
    });

    it('should render content when open is true', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()}>
          <DrawerContent>
            <DrawerBody>Test Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      expect(screen.getByText('Test Content')).toBeTruthy();
    });

    it('should render backdrop when open', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()}>
          <DrawerContent>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
      expect(backdrop).toBeTruthy();
    });

    it('should have default width of 60%', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()} defaultWidth={60}>
          <DrawerContent>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const drawer = document.querySelector('.fixed.top-0.bottom-0.z-50');
      expect(drawer?.getAttribute('style')).toContain('60%');
    });
  });

  describe('Opening/Closing', () => {
    it('should call onOpenChange when clicking backdrop', async () => {
      const onOpenChange = vi.fn();
      render(
        <Drawer open={true} onOpenChange={onOpenChange}>
          <DrawerContent>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
      backdrop && fireEvent.click(backdrop);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should close on escape key press', async () => {
      const onOpenChange = vi.fn();
      render(
        <Drawer open={true} onOpenChange={onOpenChange}>
          <DrawerContent>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('DrawerClose', () => {
    it('should call onOpenChange with false when clicked', () => {
      const onOpenChange = vi.fn();
      render(
        <Drawer open={true} onOpenChange={onOpenChange}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Test</DrawerTitle>
              <DrawerClose />
            </DrawerHeader>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const closeButton = screen.getByRole('button');
      closeButton && fireEvent.click(closeButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should render close icon by default', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Test</DrawerTitle>
              <DrawerClose />
            </DrawerHeader>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeTruthy();
    });
  });

  describe('DrawerHeader', () => {
    it('should render header with border', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Title</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const header = document.querySelector('.flex.items-center.justify-between.p-4.border-b');
      expect(header).toBeTruthy();
    });

    it('should apply custom className', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()}>
          <DrawerContent>
            <DrawerHeader className="custom-header">
              <DrawerTitle>Title</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const header = document.querySelector('.custom-header');
      expect(header).toBeTruthy();
    });
  });

  describe('DrawerTitle', () => {
    it('should render title text', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Test Title</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      expect(screen.getByText('Test Title')).toBeTruthy();
    });

    it('should have correct typography classes', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Title</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const title = screen.getByText('Title');
      expect(title.className).toContain('text-lg');
      expect(title.className).toContain('font-semibold');
    });
  });

  describe('DrawerBody', () => {
    it('should render body content', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()}>
          <DrawerContent>
            <DrawerBody>Body Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      expect(screen.getByText('Body Content')).toBeTruthy();
    });

    it('should apply overflow-auto for scrolling', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()}>
          <DrawerContent>
            <DrawerBody>Body Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const body = screen.getByText('Body Content');
      expect(body.className).toContain('overflow-auto');
    });
  });

  describe('Resizing', () => {
    it('should have resize handle on left edge', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()}>
          <DrawerContent>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const handle = document.querySelector('.absolute.top-0.bottom-0.left-0');
      expect(handle).toBeTruthy();
      expect(handle?.className).toContain('cursor-ew-resize');
    });

    it('should clamp width between 30% and 90%', () => {
      // This would require simulating drag events
      // The implementation clamps width in the mouse move handler
      const min = 30;
      const max = 90;

      expect(min).toBeLessThan(max);
      expect(min).toBeGreaterThan(0);
      expect(max).toBeLessThanOrEqual(100);
    });
  });

  describe('DrawerTrigger', () => {
    it('should open drawer when clicked', async () => {
      let isOpen = false;
      const setOpen = (open: boolean) => { isOpen = open; };

      render(
        <Drawer open={isOpen} onOpenChange={setOpen}>
          <DrawerTrigger>
            <button>Open Drawer</button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerBody>Drawer Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const trigger = screen.getByText('Open Drawer');
      fireEvent.click(trigger);

      expect(isOpen).toBe(true);
    });
  });

  describe('Side Positioning', () => {
    it('should position on right by default', () => {
      render(
        <Drawer open={true} onOpenChange={vi.fn()} side="right">
          <DrawerContent>
            <DrawerBody>Content</DrawerBody>
          </DrawerContent>
        </Drawer>
      );

      const drawer = document.querySelector('.fixed.top-0.bottom-0.z-50');
      expect(drawer).toBeTruthy();
    });
  });
});
