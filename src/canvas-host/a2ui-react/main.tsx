import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Initialize global A2UI API (compatible with existing bootstrap.js)
if (typeof window !== 'undefined') {
  // Import providers after they are created
  import('./context/A2uiMessageContext').then(() => {
    // This will be set up once providers are mounted
    console.log('[A2UI React] Initializing...');
  });
}

// Mount React app
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('[A2UI React] Root element not found');
}
