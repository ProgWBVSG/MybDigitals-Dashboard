import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, n) { if (/^\.\.?\//.test(s) && !/\.\w+$/.test(s) && c.parentURL?.includes('/src/')) s += '.ts'; return n(s, c); } });
