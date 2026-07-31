import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'

function buildHead() {
  if (/^[a-f0-9]{40}$/.test(process.env.COMMIT_REF ?? '')) return process.env.COMMIT_REF
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'UNKNOWN_UNVERIFIED_HEAD'
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __OPERATOR_BRIDGE_BUILD_HEAD__: JSON.stringify(buildHead()),
  },
})
