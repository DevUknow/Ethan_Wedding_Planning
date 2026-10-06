import {mergeConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import config from './vite.config.js';

// Keep local-storage tests isolated from the live project's configuration.
export default mergeConfig(config,{
  resolve:{alias:[{find:'../cloud-config.json',replacement:fileURLToPath(new URL('./tests/fixtures/local-cloud-config.json',import.meta.url))}]},
  define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':'""'},
});
