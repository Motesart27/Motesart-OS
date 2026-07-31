import { createStagingApi, STAGING_BANNER } from './app.mjs'
import { StagingStore } from './store.mjs'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`MISSING_REQUIRED_CONFIGURATION_${name}`)
  return value
}

if (process.env.STAGING_LABEL !== STAGING_BANNER) throw new Error('STAGING_LABEL_INVALID')
if (process.env.STAGING_DATA_ROOT && !process.env.STAGING_DATA_ROOT.startsWith('/data')) throw new Error('STAGING_DATA_ROOT_INVALID')
if (process.env.STAGING_ALLOWED_ORIGIN !== 'https://deploy-preview-22--motesart-os.netlify.app') throw new Error('STAGING_ORIGIN_INVALID')

const config = {
  allowedOrigin: required('STAGING_ALLOWED_ORIGIN'),
  expectedPreviewHead: required('STAGING_EXPECTED_PREVIEW_HEAD'),
  ownerId: required('STAGING_OWNER_ID'),
  ownerPasswordHash: required('STAGING_OWNER_PASSWORD_HASH'),
  sessionSigningKey: required('STAGING_SESSION_SIGNING_KEY'),
  orcaBootstrapTokenHash: required('STAGING_ORCA_BOOTSTRAP_TOKEN_HASH'),
  orcaSigningKey: required('STAGING_ORCA_SIGNING_KEY'),
  issuer: 'mya-operator-bridge-staging-v1',
  ownerSessionTtlSeconds: 900,
  orcaSessionTtlSeconds: 900,
}

const store = await new StagingStore({
  root: process.env.STAGING_DATA_ROOT ?? '/data/operator-bridge',
  retentionDays: 30,
}).init()
const { server } = createStagingApi({ store, config })
const port = Number(process.env.PORT ?? 3000)

const shutdown = async () => {
  server.close()
  await store.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

server.listen(port, '0.0.0.0', () => {
  console.info(JSON.stringify({ event: 'staging_control_plane_started', banner: STAGING_BANNER, port, storage_namespace: 'staging', approvals_enabled: false }))
})
