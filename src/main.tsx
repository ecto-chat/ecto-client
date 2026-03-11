import React from 'react';
import ReactDOM from 'react-dom/client';
import { initPlatform, initAuthListeners } from 'ecto-core';
import { createWebPlatform } from './platform/web-platform.js';
import { App } from './App.js';
import './app.css';
import { applyCustomCSS } from '@/lib/custom-css';
import { useUiStore } from '@/stores/ui';

// Initialize platform before anything else
initPlatform(createWebPlatform());
initAuthListeners();

// Re-apply saved custom CSS on startup
const savedCSS = useUiStore.getState().customCSS;
if (savedCSS) applyCustomCSS(savedCSS);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
