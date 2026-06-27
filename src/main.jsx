import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
// @ts-ignore
import App from './App'

const rootElement = document.getElementById('app')
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)