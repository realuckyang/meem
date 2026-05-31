import React from 'react';
import { createRoot } from 'react-dom/client';
import 'highlight.js/styles/github-dark.css';
import './index.css';
import App from './App';
import { applyTheme, getTheme } from './system/theme';

applyTheme(getTheme());

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
