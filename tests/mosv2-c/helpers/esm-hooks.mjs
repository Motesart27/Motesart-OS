// esm-hooks.mjs — ESM load hooks for the mosv2-c DOM tests. Registered via
// node:module register() from dom-mount.mjs. Two interceptions only:
//   · *.css  → empty module (styles are validated by static-scan suites and
//     the browser harness; Node mounting needs no CSS)
//   · *.jsx  → esbuild transform (automatic JSX runtime, ESM output)
// Everything else falls through to Node's default loader. esbuild is not an
// added dependency — it is already pinned in the locked tree via vite.
// Zero network: transforms read local files only.

import { readFile } from 'node:fs/promises'
import { transformSync } from 'esbuild'

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {
    return { format: 'module', source: 'export default {}\n', shortCircuit: true }
  }
  if (url.endsWith('.jsx')) {
    const source = await readFile(new URL(url), 'utf8')
    const { code } = transformSync(source, {
      loader: 'jsx',
      jsx: 'automatic',
      format: 'esm',
      target: 'esnext',
      sourcefile: url,
    })
    return { format: 'module', source: code, shortCircuit: true }
  }
  return nextLoad(url, context)
}
