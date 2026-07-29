/**
 * Stub for the `server-only` package.
 *
 * `server-only` works by shipping two builds and letting the bundler pick: the
 * "client" one throws on import, which is what turns "a Client Component
 * imported a server module" into a build error. Vitest has no React Server
 * Component graph, so it resolves the throwing build and every server module
 * would fail to import.
 *
 * Aliasing it to this empty module in vitest.config.ts removes the guard *in
 * tests only*. The real guard is still fully in force in `next build` and
 * `next dev`, which is where it matters.
 */
export {};
