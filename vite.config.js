import { defineConfig } from 'vite';

// Relative asset paths so the same build works at the domain root
// and under a project path such as /tero_game/ on GitHub Pages.
export default defineConfig({
  base: './',
});
