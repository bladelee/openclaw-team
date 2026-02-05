import React from 'react';
import { A2uiMessageProvider } from './context/A2uiMessageContext';
import { A2uiThemeProvider } from './context/A2uiThemeContext';
import { A2uiActionProvider } from './context/A2uiActionContext';
import { A2uiHost } from './components/A2uiHost';
import { A2uiInternalApi } from './components/InternalApi';
import { A2uiDemo } from './demo';
import './styles/reset.css';
import './styles/theme.css';
import './styles/mobile.css';

/**
 * OpenClaw A2UI React Application
 * Main app component with context providers
 */
export const App: React.FC = () => {
  return (
    <A2uiThemeProvider>
      <A2uiMessageProvider>
        <A2uiActionProvider>
          {/* Internal API must be inside providers to access context */}
          <A2uiInternalApi />
          <A2uiDemo />
          <A2uiHost />
        </A2uiActionProvider>
      </A2uiMessageProvider>
    </A2uiThemeProvider>
  );
};

export default App;
