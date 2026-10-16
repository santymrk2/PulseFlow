import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './index.css'
import { setupTauriApi } from './IPC/tauri.ts'
import App from './App.tsx'
import OutputView from './components/OutputView.tsx'
import StageView from './components/StageView.tsx'

setupTauriApi()

// La misma app React sirve a varios roles según su ventana nativa: el panel de
// Control (por defecto), la ventana de Audiencia (etiqueta "output") y la de
// Stage/músicos (etiqueta "stage").
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const windowLabel = isTauri ? getCurrentWindow().label : 'main'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {windowLabel === 'output' ? <OutputView /> : windowLabel === 'stage' ? <StageView /> : <App />}
  </StrictMode>,
)
