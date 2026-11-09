import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ApiConfigError, assertApiBaseUrl } from './api'
import './styles/theme.css'
import './styles/fonts.css'
import './styles/global.css'
import './styles/results.css'
import './styles/home-modes.css'
import './styles/screen-shell.css'
import { WalletRoot } from './wallet/WalletRoot'

/**
 * Startup env gate — a misconfigured production build (missing/localhost
 * VITE_API_URL) throws ApiConfigError. Catch it here and render the reason
 * on a loading-screen shell instead of booting into a broken app.
 */
function BootGate() {
  try {
    assertApiBaseUrl()
    return <App />
  } catch (err) {
    console.error('[boot] fatal config error:', err)
    const message = err instanceof ApiConfigError ? err.message : 'Fatal configuration error'
    return (
      <section className="flow-screen loading-screen" role="alert">
        <div className="loading-screen__panel">
          <p className="loading-screen__brand display">Fruit Rush</p>
          <p className="loading-screen__label loading-screen__error">{message}</p>
        </div>
      </section>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletRoot>
      <BootGate />
    </WalletRoot>
  </StrictMode>,
)
