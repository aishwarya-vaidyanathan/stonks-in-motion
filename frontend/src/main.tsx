import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Apply dark mode based on system preference
if (
  window.matchMedia('(prefers-color-scheme: dark)').matches ||
  !window.matchMedia('(prefers-color-scheme: light)').matches
) {
  document.documentElement.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
