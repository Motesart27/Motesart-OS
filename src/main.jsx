import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const STAGING_HOST = 'deploy-preview-22--motesart-os.netlify.app'
const stagingSurface = window.location.hostname === STAGING_HOST && window.location.pathname.startsWith('/operator-bridge-staging')
const root = createRoot(document.getElementById('root'))

async function bootstrap() {
  if (stagingSurface) {
    const { default: StagingOperatorBridgeApp } = await import('./operator-bridge-staging/StagingOperatorBridgeApp.jsx')
    root.render(<StrictMode><StagingOperatorBridgeApp buildHead={__OPERATOR_BRIDGE_BUILD_HEAD__} /></StrictMode>)
    return
  }
  const [{ BrowserRouter }, { AuthProvider }, { ToastProvider }, { default: App }] = await Promise.all([
    import('react-router-dom'),
    import('./context/AuthContext.jsx'),
    import('./components/Toast.jsx'),
    import('./App.jsx'),
  ])
  root.render(<StrictMode><BrowserRouter><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></BrowserRouter></StrictMode>)
}

bootstrap()
