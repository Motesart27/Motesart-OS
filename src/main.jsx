import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import App from './App.jsx'
import StagingOperatorBridgeApp from './operator-bridge-staging/StagingOperatorBridgeApp.jsx'

const STAGING_HOST = 'deploy-preview-22--motesart-os.netlify.app'
const stagingSurface = window.location.hostname === STAGING_HOST && window.location.pathname.startsWith('/operator-bridge-staging')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {stagingSurface
      ? <StagingOperatorBridgeApp buildHead={__OPERATOR_BRIDGE_BUILD_HEAD__} />
      : <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>}
  </StrictMode>,
)
