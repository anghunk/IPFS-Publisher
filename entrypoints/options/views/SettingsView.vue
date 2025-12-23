<template>
  <div class="settings-view">
    <div class="page-header">
      <h2>{{ $t('settings.title') }}</h2>
      <p class="subtitle">{{ $t('settings.subtitle') }}</p>
    </div>

    <div class="settings-card">
      <div class="setting-section">
        <h3>{{ $t('settings.gatewaySection') }}</h3>
        <p class="setting-desc">{{ $t('settings.gatewayDesc') }}</p>
        
        <el-form label-position="top">
          <el-form-item :label="$t('settings.gatewayLabel')">
            <el-input 
              v-model="settings.gateway" 
              :placeholder="$t('settings.gatewayPlaceholder')"
              size="large"
            >
              <template #append>
                <el-button @click="testGateway" :loading="testing">
                  {{ $t('settings.testConnection') }}
                </el-button>
              </template>
            </el-input>
            <div class="input-tip">
              {{ $t('settings.gatewayExample') }}
            </div>
          </el-form-item>

          <el-form-item :label="$t('settings.commonGateways')">
            <div class="gateway-presets">
              <el-tag 
                v-for="preset in gatewayPresets" 
                :key="preset.url"
                :type="settings.gateway === preset.url ? 'warning' : 'info'"
                class="preset-tag"
                @click="selectPreset(preset.url)"
              >
                {{ preset.name }}
              </el-tag>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <div class="setting-section">
        <h3>{{ $t('settings.nodeSection') }}</h3>
        <p class="setting-desc">{{ $t('settings.nodeDesc') }}</p>
        
        <el-form label-position="top">
          <el-form-item :label="$t('settings.apiLabel')">
            <el-input 
              v-model="settings.apiEndpoint" 
              :placeholder="$t('settings.apiPlaceholder')"
              size="large"
            />
            <div class="input-tip">
              {{ $t('settings.apiTip') }}
            </div>
          </el-form-item>
        </el-form>
      </div>

      <!-- 语言设置 -->
      <div class="setting-section">
        <h3>{{ $t('settings.languageSection') }}</h3>
        <p class="setting-desc">{{ $t('settings.languageDesc') }}</p>
        
        <el-form label-position="top">
          <el-form-item :label="$t('settings.languageLabel')">
            <el-select v-model="language" size="large" @change="handleLanguageChange">
              <el-option value="auto" :label="$t('settings.languageAuto')" />
              <el-option value="zh" :label="$t('settings.languageChinese')" />
              <el-option value="en" :label="$t('settings.languageEnglish')" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <!-- <div class="setting-section">
        <h3>IPNS 文章列表</h3>
        <p class="setting-desc">生成固定的文章列表链接，更新文章后链接不变</p>
        
        <el-form label-position="top">
          <el-form-item label="IPNS 密钥">
            <div class="key-selector">
              <el-select 
                v-model="selectedKey" 
                placeholder="选择密钥"
                size="large"
                style="flex: 1;"
              >
                <el-option 
                  v-for="key in ipnsKeys" 
                  :key="key.Name" 
                  :label="key.Name" 
                  :value="key.Name"
                />
              </el-select>
              <el-button @click="loadKeys" :loading="loadingKeys">刷新</el-button>
              <el-button type="primary" @click="showCreateKeyDialog = true">新建</el-button>
            </div>
            <div class="input-tip">
              选择或创建一个密钥用于发布文章列表
            </div>
          </el-form-item>

          <el-form-item v-if="settings.ipnsUrl">
            <div class="ipns-url-box">
              <span class="label">IPNS 链接：</span>
              <a :href="settings.ipnsUrl" target="_blank" class="ipns-link">{{ settings.ipnsUrl }}</a>
              <el-button size="small" @click="copyIpnsUrl">复制</el-button>
            </div>
          </el-form-item>

          <el-button 
            type="warning" 
            size="large" 
            @click="publishListToIpns" 
            :loading="publishing"
            :disabled="!selectedKey"
            style="width: 100%;"
          >
            {{ settings.ipnsUrl ? '更新文章列表页' : '发布文章列表页' }}
          </el-button>
          <div class="input-tip" style="text-align: center; margin-top: 12px;">
            发布后获得固定的 IPNS 链接，文章更新后只需点击「更新」即可
          </div>
        </el-form>
      </div> -->

      <div class="form-actions">
        <el-button @click="resetSettings" size="large">{{ $t('settings.resetDefaults') }}</el-button>
        <el-button type="primary" @click="saveSettings" size="large" :loading="saving">
          {{ $t('settings.saveSettings') }}
        </el-button>
      </div>
    </div>

    <!-- 创建密钥对话框 -->
    <el-dialog v-model="showCreateKeyDialog" title="创建 IPNS 密钥" width="400px">
      <el-form label-position="top">
        <el-form-item label="密钥名称">
          <el-input v-model="newKeyName" placeholder="例如：my-articles" />
          <div class="input-tip">只能包含字母、数字和连字符</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateKeyDialog = false">取消</el-button>
        <el-button type="primary" @click="createKey" :loading="creatingKey">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { getBrowserLanguage } from '../../../utils/i18n';

const { t, locale } = useI18n();

interface Settings {
  gateway: string;
  apiEndpoint: string;
  ipnsKeyName?: string;
  ipnsId?: string;
  ipnsUrl?: string;
}

interface IpnsKey {
  Name: string;
  Id: string;
}

const settings = ref<Settings>({
  gateway: 'https://ipfs.io/ipfs/',
  apiEndpoint: 'http://127.0.0.1:5001'
});

const testing = ref(false);
const saving = ref(false);
const loadingKeys = ref(false);
const publishing = ref(false);
const creatingKey = ref(false);
const showCreateKeyDialog = ref(false);
const newKeyName = ref('');
const ipnsKeys = ref<IpnsKey[]>([]);
const selectedKey = ref('');
const language = ref('auto');

const gatewayPresets = [
  { name: 'IPFS.io', url: 'https://ipfs.io/ipfs/' },
  { name: 'Dweb.link', url: 'https://dweb.link/ipfs/' },
  { name: 'Cloudflare', url: 'https://cloudflare-ipfs.com/ipfs/' },
  { name: 'Pinata', url: 'https://gateway.pinata.cloud/ipfs/' },
  { name: 'W3s.link', url: 'https://w3s.link/ipfs/' }
];

onMounted(async () => {
  await loadSettings();
  await loadLanguage();
  await loadKeys();
});

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
    if (response.success && response.data) {
      settings.value = { ...settings.value, ...response.data };
      if (response.data.ipnsKeyName) {
        selectedKey.value = response.data.ipnsKeyName;
      }
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

async function loadLanguage() {
  try {
    const result = await chrome.storage.local.get('language');
    language.value = result.language || 'auto';
  } catch (e) {
    console.error('Failed to load language:', e);
  }
}

async function handleLanguageChange(newLang: string) {
  try {
    await chrome.storage.local.set({ language: newLang });
    const actualLang = newLang === 'auto' ? getBrowserLanguage() : newLang;
    locale.value = actualLang;
    ElMessage.success(t('settings.settingsSaved'));
  } catch (e) {
    console.error('Failed to save language:', e);
  }
}

async function loadKeys() {
  loadingKeys.value = true;
  try {
    const response = await chrome.runtime.sendMessage({ action: 'listKeys' });
    if (response.success) {
      ipnsKeys.value = response.data;
    }
  } catch (e) {
    console.error('Failed to load keys:', e);
  } finally {
    loadingKeys.value = false;
  }
}

async function createKey() {
  if (!newKeyName.value.trim()) {
    ElMessage.warning('请输入密钥名称');
    return;
  }
  
  creatingKey.value = true;
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'generateKey', 
      keyName: newKeyName.value.trim() 
    });
    
    if (response.success) {
      ElMessage.success('密钥创建成功');
      selectedKey.value = response.data.Name;
      showCreateKeyDialog.value = false;
      newKeyName.value = '';
      await loadKeys();
    } else {
      throw new Error(response.error);
    }
  } catch (error: any) {
    ElMessage.error('创建失败: ' + error.message);
  } finally {
    creatingKey.value = false;
  }
}

async function publishListToIpns() {
  if (!selectedKey.value) {
    ElMessage.warning('请先选择或创建 IPNS 密钥');
    return;
  }
  
  publishing.value = true;
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'publishListToIpns', 
      keyName: selectedKey.value 
    });
    
    if (response.success) {
      settings.value.ipnsUrl = response.data.ipnsUrl;
      settings.value.ipnsId = response.data.ipnsId;
      settings.value.ipnsKeyName = selectedKey.value;
      ElMessage.success('IPNS 发布成功！');
    } else {
      throw new Error(response.error);
    }
  } catch (error: any) {
    ElMessage.error('发布失败: ' + error.message);
  } finally {
    publishing.value = false;
  }
}

async function copyIpnsUrl() {
  if (settings.value.ipnsUrl) {
    await navigator.clipboard.writeText(settings.value.ipnsUrl);
    ElMessage.success('链接已复制');
  }
}

function selectPreset(url: string) {
  settings.value.gateway = url;
}

async function testGateway() {
  if (!settings.value.gateway) {
    ElMessage.warning(t('settings.enterGateway'));
    return;
  }
  
  testing.value = true;
  try {
    // 使用一个已知的小 CID 来测试
    const testCid = 'QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX';
    const testUrl = `${settings.value.gateway}${testCid}`;
    
    const response = await fetch(testUrl, { 
      method: 'HEAD',
      mode: 'no-cors'
    });
    
    ElMessage.success(t('settings.gatewayConnected'));
  } catch (error) {
    ElMessage.warning(t('settings.gatewayUnavailable'));
  } finally {
    testing.value = false;
  }
}

async function saveSettings() {
  // 确保网关地址以 / 结尾
  if (settings.value.gateway && !settings.value.gateway.endsWith('/')) {
    settings.value.gateway += '/';
  }
  
  saving.value = true;
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'saveSettings', 
      data: settings.value 
    });
    
    if (response.success) {
      ElMessage.success(t('settings.settingsSaved'));
    } else {
      throw new Error(response.error);
    }
  } catch (error: any) {
    ElMessage.error(t('settings.saveFailed') + ': ' + error.message);
  } finally {
    saving.value = false;
  }
}

async function resetSettings() {
  settings.value = {
    gateway: 'https://ipfs.io/ipfs/',
    apiEndpoint: 'http://127.0.0.1:5001'
  };
  await saveSettings();
}
</script>

<style scoped lang="less">
@primary: #F5D104;
@primary-dark: #D4B503;
@bg-dark: #1a1a2e;

.settings-view {
  max-width: 700px;
}

.page-header {
  margin-bottom: 24px;
  
  h2 {
    margin: 0 0 4px 0;
    font-size: 24px;
    color: @bg-dark;
    font-weight: 600;
  }
  
  .subtitle {
    margin: 0;
    font-size: 14px;
    color: #6b7280;
  }
}

.settings-card {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.setting-section {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
  
  &:last-of-type {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  
  h3 {
    margin: 0 0 8px 0;
    font-size: 16px;
    color: @bg-dark;
    font-weight: 600;
  }
  
  .setting-desc {
    margin: 0 0 20px 0;
    font-size: 13px;
    color: #6b7280;
  }
}

.input-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
}

.gateway-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  
  .preset-tag {
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      transform: translateY(-1px);
    }
  }
}

.key-selector {
  display: flex;
  gap: 8px;
}

.ipns-url-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fefce8;
  border-radius: 8px;
  border: 1px solid @primary;
  width: 100%;
  
  .label {
    font-size: 13px;
    color: #6b7280;
    white-space: nowrap;
  }
  
  .ipns-link {
    flex: 1;
    color: @primary-dark;
    word-break: break-all;
    font-size: 13px;
  }
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

// 媒体查询适配
@media (max-width: 768px) {
  .settings-card {
    padding: 24px 20px;
  }
  
  .page-header h2 {
    font-size: 20px;
  }
  
  .form-actions {
    flex-direction: column-reverse;
    
    .el-button {
      width: 100%;
    }
  }
  
  .gateway-presets {
    .preset-tag {
      flex: 1;
      text-align: center;
      min-width: calc(50% - 4px);
    }
  }
}

@media (max-width: 480px) {
  .settings-card {
    padding: 16px;
    border-radius: 12px;
  }
  
  .page-header h2 {
    font-size: 18px;
  }
}
</style>
