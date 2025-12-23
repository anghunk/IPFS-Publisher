import { createApp } from 'vue';
import App from './App.vue';
import { createI18nInstance } from '../../utils/i18n';

import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';

import './style.less';

// 异步初始化应用
async function initApp() {
  const i18n = await createI18nInstance();
  const app = createApp(App);

  // 注册所有图标
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component);
  }

  app.use(ElementPlus);
  app.use(i18n);
  app.mount('#app');
}

initApp();
