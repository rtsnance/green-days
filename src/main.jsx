import React from 'react';
import { createRoot } from 'react-dom/client';
import './gd/styles.css';
import './app.css';
import GreenDaysApp from './GreenDaysApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GreenDaysApp />
  </React.StrictMode>
);
