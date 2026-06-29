import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { ManagerApp } from './react/manager-app';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ManagerApp />
      <Toaster position="top-right" />
    </ThemeProvider>
  </React.StrictMode>
);
