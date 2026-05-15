import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './viewer-app';
import './viewer.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
