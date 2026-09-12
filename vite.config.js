import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo>/, not the domain root
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/tenth-hero/' : '/',
  // main.js awaits the scene at the top level; the default target predates that
  build: { target: 'es2022' },
});
