'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Type-safe icon wrapper
const MessageSquareIcon = LucideIcons.MessageSquare as React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface ChatButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ChatButton({ onClick, disabled = false, className }: ChatButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={className}
            onClick={onClick}
            disabled={disabled}
          >
            <MessageSquareIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Open Chat</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
