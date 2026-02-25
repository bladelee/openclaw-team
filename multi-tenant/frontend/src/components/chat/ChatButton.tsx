'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
            <MessageSquare className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Open Chat</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
