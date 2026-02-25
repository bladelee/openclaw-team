'use client';

import React, { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  DrawerBody,
} from '@/components/ui/drawer';
import { ChatIframe } from './ChatIframe';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatDrawerProps {
  instanceUrl: string;
  instanceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatDrawer({
  instanceUrl,
  instanceName,
  open,
  onOpenChange,
}: ChatDrawerProps) {
  const iframeUrl = `${instanceUrl}/chat`; // Point to chat UI

  const handleOpenInNewTab = () => {
    window.open(iframeUrl, '_blank');
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} defaultWidth={60} side="right">
      <DrawerContent className="flex flex-col">
        <DrawerHeader>
          <div className="flex items-center justify-between">
            <DrawerTitle>Chat - {instanceName}</DrawerTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
                className="gap-1"
              >
                <ExternalLink className="h-4 w-4" />
                New Window
              </Button>
              <DrawerClose />
            </div>
          </div>
        </DrawerHeader>
        <DrawerBody className="flex-1">
          <ChatIframe url={iframeUrl} />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

interface UseChatDrawerResult {
  isOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  ChatDrawerComponent: React.FC<{ instanceUrl: string; instanceName: string }>;
}

export function useChatDrawer(): UseChatDrawerResult {
  const [isOpen, setIsOpen] = useState(false);
  const [instanceUrl, setInstanceUrl] = useState('');
  const [instanceName, setInstanceName] = useState('');

  const openChat = (url: string, name: string) => {
    setInstanceUrl(url);
    setInstanceName(name);
    setIsOpen(true);
  };

  const closeChat = () => setIsOpen(false);

  const ChatDrawerComponent = () => (
    <ChatDrawer
      instanceUrl={instanceUrl}
      instanceName={instanceName}
      open={isOpen}
      onOpenChange={setIsOpen}
    />
  );

  return {
    isOpen,
    openChat,
    closeChat,
    ChatDrawerComponent,
  };
}
