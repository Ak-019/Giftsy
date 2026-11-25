import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <App />
              <Toaster
                position="top-center"
                toastOptions={{
                  style: { background: '#5E3A4D', color: '#F4E1D2', borderRadius: '999px', fontSize: '14px' },
                  success: { iconTheme: { primary: '#A8B89A', secondary: '#3B2430' } },
                  error: { style: { background: '#B3261E', color: '#FFFFFF' }, iconTheme: { primary: '#FFFFFF', secondary: '#B3261E' }, duration: 5000 },
                }}
              />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
