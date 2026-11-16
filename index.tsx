
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AdBlockProvider } from './context/AdBlockContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Global error handler for uncaught module/promise errors (prevents third-party embed script rejections from crashing the app)
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Handled Promise Rejection:', event.reason);
  event.preventDefault?.();
});

window.onerror = (message, source, lineno, colno, error) => {
  console.warn('Global Error caught:', message, 'at', source, lineno, ':', colno, error);
  return true;
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AdBlockProvider>
        <App />
      </AdBlockProvider>
    </BrowserRouter>
  </React.StrictMode>
);
