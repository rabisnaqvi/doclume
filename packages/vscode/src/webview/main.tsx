import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapRoot } from '@doclume/core';
import { Viewer } from './Viewer';
import './viewer.css';

bootstrapRoot((root) => {
  createRoot(root).render(
    <StrictMode>
      <Viewer />
    </StrictMode>,
  );
});
