import {default as dts} from 'bun-plugin-dts'

await Bun.build({
  entrypoints: ['./src/mod.ts'],
  outdir: './dist',
  plugins: [
    dts()
  ],
})
