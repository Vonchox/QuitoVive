import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://vonchox.github.io',
  base: '/QuitoVive',
  trailingSlash: 'always',
  redirects: {
    '/blog/': '/QuitoVive/planes/',
    '/blog/un-sabado-en-el-centro/': '/QuitoVive/planes/',
    '/blog/curare-25-anos/': '/QuitoVive/planes/',
    '/blog/escuchar-el-teatro-sucre/': '/QuitoVive/planes/',
  },
});
