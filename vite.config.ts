import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

// One version number for the website, the Android app and the Windows app:
// package.json "version" (change it with `npm run version:set -- 1.0.2`).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

/**
 * Writes dist/precache.json: the built files the website's offline helper
 * (public/sw.js) saves on the first visit, so the iPhone home-screen app opens
 * without internet straight away. Only scripts, styles and the Latin fonts.
 */
function precacheList(): Plugin {
  return {
    name: 'bl-precache-list',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css)$/.test(f) || /latin-\d+-normal.*\.woff2$/.test(f))
        .filter((f) => !/-ext-/.test(f))
        .map((f) => `/${f}`)
        .sort()
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify({ version, files }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precacheList()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // Changes with every build, so the website's offline helper re-saves the new files.
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
})
