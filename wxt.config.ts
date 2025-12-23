import { defineConfig } from 'wxt';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';
import pkg from './package.json';

const __dirname = dirname(fileURLToPath(import.meta.url));

// See https://wxt.dev/api/config.html
export default defineConfig({
  // 将所有输出写入同一目录
  // https://wxt.dev/guide/resources/upgrading.html#default-output-directories-changed
  outDirTemplate: '{{browser}}-mv{{manifestVersion}}',
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [
      VueI18nPlugin({
        include: resolve(__dirname, './locales/**'),
        strictMessage: false,
        // 启用 JIT 编译，预编译消息为函数
        jitCompilation: true,
      }),
    ],
    define: {
      // vue-i18n 特性标志
      __VUE_I18N_FULL_INSTALL__: true,
      __VUE_I18N_LEGACY_API__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
      __INTLIFY_JIT_COMPILATION__: true,
    },
  }),
  manifest: {
    name: 'IPFS Publisher',
    version: pkg.version,
    description: '一键发布 Markdown 内容到 IPFS 的浏览器扩展',
    permissions: ['storage'],
    host_permissions: ['http://127.0.0.1:5001/*'],
    action: {
      default_title: '打开 IPFS 发布器',
    },
  },
});
