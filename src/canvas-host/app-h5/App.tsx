/**
 * App 主应用组件
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ChatPage } from './pages/chat/ChatPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { CanvasPage } from './pages/canvas/CanvasPage';
import './styles/variables.css';

/**
 * 应用路由组件
 */
function AppRouter() {
  const { currentPage } = useApp();

  switch (currentPage) {
    case 'settings':
      return <SettingsPage />;
    case 'canvas':
      return <CanvasPage />;
    case 'chat':
    default:
      return <ChatPage />;
  }
}

/**
 * App 主组件
 */
export function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
