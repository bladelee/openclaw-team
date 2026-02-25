'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const TooltipProviderContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

export interface TooltipProviderProps {
  children: React.ReactNode;
}

export function TooltipProvider({ children }: TooltipProviderProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <TooltipProviderContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </TooltipProviderContext.Provider>
  );
}

export interface TooltipProps {
  children: React.ReactNode;
}

export function Tooltip({ children }: TooltipProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  React.useEffect(() => {
    if (isHovered && triggerRef.current && contentRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();

      setPosition({
        top: triggerRect.bottom + 8,
        left: triggerRect.left + (triggerRect.width - contentRect.width) / 2,
      });
    }
  }, [isHovered]);

  // Find TooltipTrigger and TooltipContent children
  const childrenArray = React.Children.toArray(children);
  const trigger = childrenArray.find(
    (child): child is React.ReactElement => {
      return React.isValidElement(child) && child.type === TooltipTrigger;
    }
  );
  const content = childrenArray.find(
    (child): child is React.ReactElement => {
      return React.isValidElement(child) && child.type === TooltipContent;
    }
  );

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="inline-block"
    >
      {trigger}
      {isHovered &&
        React.cloneElement(content as React.ReactElement, {
          ref: contentRef,
          style: {
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
          },
        })}
    </div>
  );
}

export interface TooltipTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export function TooltipTrigger({ asChild = false, children }: TooltipTriggerProps) {
  return <>{children}</>;
}

export interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  ref?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
}

export function TooltipContent({
  children,
  className,
  side = 'top',
  ref,
  style,
}: TooltipContentProps) {
  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
        className
      )}
    >
      {children}
    </div>
  );
}
