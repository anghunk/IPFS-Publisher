import { createI18n } from 'vue-i18n';

// 静态导入语言文件（通过 unplugin-vue-i18n 预编译）
import zh from '../locales/zh.json';
import en from '../locales/en.json';

// 语言资源
const messages = {
  zh,
  en,
};

// 获取浏览器语言
function getBrowserLanguage(): string {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh')) {
    return 'zh';
  }
  return 'en';
}

// 获取保存的语言设置
async function getSavedLanguage(): Promise<string> {
  try {
    const result = await chrome.storage.local.get('language');
    return result.language || 'auto';
  } catch (e) {
    return 'auto';
  }
}

// 创建 i18n 实例
export async function createI18nInstance() {
  const savedLang = await getSavedLanguage();
  const locale = savedLang === 'auto' ? getBrowserLanguage() : savedLang;
  
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages,
    globalInjection: true, // 启用全局 $t 函数
  });
}

export { getBrowserLanguage, getSavedLanguage };
