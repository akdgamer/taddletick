import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DisplayPage } from './components/DisplayPage.tsx'

// The Pi's little touch screen opens /?display (see DEPLOY.md, desk display)
const isDisplay = new URLSearchParams(window.location.search).has('display')

createRoot(document.getElementById('root')!).render(<StrictMode>{isDisplay ? <DisplayPage /> : <App />}</StrictMode>)
