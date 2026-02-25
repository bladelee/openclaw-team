'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DrawerContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  width: number;
  setWidth: (width: number) => void;
}

const DrawerContext = React.createContext<DrawerContextValue | undefined>(undefined);

export interface DrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  defaultWidth?: number; // percentage (0-100)
  side?: 'left' | 'right';
}

export function Drawer({
  open = false,
  onOpenChange,
  children,
  defaultWidth = 60,
  side = 'right',
}: DrawerProps) {
  const [internalOpen, setInternalOpen] = React.useState(open);
  const [width, setWidth] = React.useState(defaultWidth);
  const [isResizing, setIsResizing] = React.useState(false);

  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = React.useCallback(
    (value: boolean) => {
      setInternalOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange]
  );

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const windowWidth = window.innerWidth;
      const newWidth = side === 'right'
        ? ((windowWidth - e.clientX) / windowWidth) * 100
        : (e.clientX / windowWidth) * 100;

      // Clamp width between 30% and 90%
      setWidth(Math.min(Math.max(newWidth, 30), 90));
    },
    [isResizing, side]
  );

  const handleMouseUp = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Close on escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, setIsOpen]);

  return (
    <DrawerContext.Provider value={{ isOpen, setIsOpen, width, setWidth }}>
      {children}
    </DrawerContext.Provider>
  );
}

export interface DrawerTriggerProps {
  asChild?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function DrawerTrigger({ asChild = false, className, children }: DrawerTriggerProps) {
  const context = React.useContext(DrawerContext);

  if (!context) {
    throw new Error('DrawerTrigger must be used within a Drawer');
  }

  const { setIsOpen } = context;

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: () => setIsOpen(true),
    });
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => setIsOpen(true)}
    >
      {children}
    </button>
  );
}

export interface DrawerContentProps {
  className?: string;
  children: React.ReactNode;
}

export function DrawerContent({ className, children }: DrawerContentProps) {
  const context = React.useContext(DrawerContext);

  if (!context) {
    throw new Error('DrawerContent must be used within a Drawer');
  }

  const { isOpen, setIsOpen, width } = context;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 bottom-0 z-50 bg-background shadow-lg animate-in slide-in-from-right duration-300',
          className
        )}
        style={{
          right: 0,
          width: `${width}%`,
        }}
      >
        {/* Resize Handle */}
        <div
          className="absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize hover:bg-primary/20 active:bg-primary/40 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            const handleMouseMove = (e: MouseEvent) => {
              const windowWidth = window.innerWidth;
              const newWidth = ((windowWidth - e.clientX) / windowWidth) * 100;
              // Clamp width between 30% and 90%
              const clampedWidth = Math.min(Math.max(newWidth, 30), 90);
              (e.target as HTMLElement).parentElement?.style.setProperty('width', `${clampedWidth}%`);
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />

        {children}
      </div>
    </>
  );
}

export interface DrawerHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DrawerHeader({ className, children }: DrawerHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between p-4 border-b', className)}>
      {children}
    </div>
  );
}

export interface DrawerTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function DrawerTitle({ className, children }: DrawerTitleProps) {
  return (
    <h2 className={cn('text-lg font-semibold', className)}>
      {children}
    </h2>
  );
}

export interface DrawerCloseProps {
  className?: string;
  children?: React.ReactNode;
}

export function DrawerClose({ className, children }: DrawerCloseProps) {
  const context = React.useContext(DrawerContext);

  if (!context) {
    throw new Error('DrawerClose must be used within a Drawer');
  }

  const { setIsOpen } = context;

  return (
    <button
      type="button"
      className={cn(
        'rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-secondary',
        className
      )}
      onClick={() => setIsOpen(false)}
    >
      {children || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      <span className="sr-only">Close</span>
    </button>
  );
}

export interface DrawerBodyProps {
  className?: string;
  children: React.ReactNode;
}

export function DrawerBody({ className, children }: DrawerBodyProps) {
  return (
    <div className={cn('flex-1 overflow-auto', className)}>
      {children}
    </div>
  );
}
