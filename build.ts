await Bun.build({
    entrypoints: ['./src/index.tsx'],
    outdir: './dist',
    minify: true,
    target: 'browser',
    sourcemap: 'external',
    external: ['react', 'graphql-mobius']
})

export {}
