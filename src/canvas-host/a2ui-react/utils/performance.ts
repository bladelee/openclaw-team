/**
 * Performance Utilities
 * Debounce, throttle, and other performance optimization helpers
 */

import React from 'react';

/**
 * Debounce function - delays execution until after wait milliseconds have elapsed
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - limits execution to once every wait milliseconds
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastResult: ReturnType<T>;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      inThrottle = true;
      lastResult = func(...args) as ReturnType<T>;

      setTimeout(() => {
        inThrottle = false;
      }, wait);
    }
    return lastResult;
  };
}

/**
 * Request animation frame throttle
 * Use this for visual updates (scrolling, resizing, etc.)
 */
export function rafThrottle<T extends (...args: unknown[]) => unknown>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;

  return function executedFunction(...args: Parameters<T>) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
      func(...args);
      rafId = null;
    });
  };
}

/**
 * Batch state updates to reduce re-renders
 */
export function batchUpdates<T>(items: T[], processor: (item: T) => void, batchSize = 10) {
  let index = 0;

  function processBatch() {
    const batch = items.slice(index, index + batchSize);

    for (const item of batch) {
      processor(item);
    }

    index += batchSize;

    if (index < items.length) {
      // Use setTimeout(0) to yield to the browser
      setTimeout(processBatch, 0);
    }
  }

  processBatch();
}

/**
 * Lazy load component when it comes into viewport
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) {
  React.useEffect(() => {
    const observer = new IntersectionObserver(callback, options);

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [ref, callback, options]);
}

/**
 * Memoize component props deeply
 */
export function useDeepMemo<T>(value: T): T {
  const ref = React.useRef<T>(value);

  // Simple deep equality check (JSON.stringify is not perfect but works for most cases)
  const serialized = JSON.stringify(value);
  const prevSerialized = JSON.stringify(ref.current);

  if (serialized !== prevSerialized) {
    ref.current = value;
  }

  return ref.current;
}

/**
 * Performant event handler that prevents default and stops propagation
 */
export function composeEventHandlers<
  E extends React.SyntheticEvent | Event
>(
  theirHandler: ((event: E) => unknown) | undefined,
  ourHandler: (event: E) => unknown,
  { checkForDefaultPrevented = true } = {}
) {
  return function handleEvent(event: E) {
    theirHandler?.(event);

    if (checkForDefaultPrevented) {
      if (event.defaultPrevented) {
        return;
      }
    }

    return ourHandler(event);
  };
}
