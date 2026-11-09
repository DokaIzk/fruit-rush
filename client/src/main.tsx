import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/theme.css'
import './styles/fonts.css'
import './styles/global.css'
import './styles/results.css'
import './styles/home-modes.css'
import './styles/screen-shell.css'
import { WalletRoot } from './wallet/WalletRoot'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletRoot>
      <App />
    </WalletRoot>
  </StrictMode>,
)
