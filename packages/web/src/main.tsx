import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapRoot } from '@doclume/core';
import { App } from './App';
import './fonts.css';
import './app.css';

bootstrapRoot((root) => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
