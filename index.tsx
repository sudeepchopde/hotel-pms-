import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Deployed site: default ~80% zoom so the dense UI fits typical laptop viewports.
// Dev (`npm run dev`) stays at 100% for easier debugging.
if (import.meta.env.PROD) {
  document.documentElement.style.zoom = '0.8';
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
