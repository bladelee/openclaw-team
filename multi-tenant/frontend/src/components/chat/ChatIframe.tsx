'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ChatIframeProps {
  url: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function ChatIframe({ url, onLoad, onError }: ChatIframeProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [url]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading Chat...</p>
          </div>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-2 text-center p-4">
            <p className="text-sm text-destructive">Failed to load Chat</p>
            <p className="text-xs text-muted-foreground">
              Make sure the instance URL is accessible
            </p>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={url}
        className="w-full h-full border-0"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        allow="microphone; camera; clipboard-write"
        onLoad={handleLoad}
        onError={handleError}
        title="OpenClaw Chat"
      />
    </div>
  );
}
