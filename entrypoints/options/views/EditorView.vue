<template>
  <div class="editor-view">
    <div class="page-header">
      <h2>{{ isEditing ? $t('editor.editTitle') : $t('editor.title') }}</h2>
      <p class="subtitle">{{ $t('editor.subtitle') }}</p>
    </div>
    
    <div class="editor-card">
      <el-form :model="form" label-position="top">
        <el-form-item :label="$t('editor.articleTitle')">
          <el-input 
            v-model="form.title" 
            :placeholder="$t('editor.titlePlaceholder')"
            :disabled="publishing"
            size="large"
          />
        </el-form-item>

        <el-form-item :label="$t('editor.articleContent')">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="16"
            :placeholder="$t('editor.contentPlaceholder')"
            :disabled="publishing"
          />
        </el-form-item>
      </el-form>
      
      <div class="form-actions">
        <el-button v-if="isEditing" @click="cancelEdit" size="large">{{ $t('editor.cancelEdit') }}</el-button>
        <el-button 
          type="primary" 
          :loading="publishing" 
          :disabled="!canPublish"
          @click="handlePublish"
          size="large"
          class="publish-btn"
        >
          {{ publishing ? $t('editor.publishing') : (isEditing ? $t('editor.republish') : $t('editor.publish')) }}
        </el-button>
      </div>
    </div>

    <!-- 发布结果 -->
    <div v-if="publishResult" class="publish-result">
      <el-alert
        v-if="publishResult.success"
        type="success"
        :closable="false"
        show-icon
      >
        <template #title>{{ $t('editor.publishSuccess') }}</template>
        <template #default>
          <div class="result-content">
            <p><strong>{{ $t('editor.cid') }}:</strong> {{ publishResult.data.cid }}</p>
            <div class="result-actions">
              <el-link :href="publishResult.data.url" target="_blank" type="primary">
                <el-icon><Link /></el-icon> {{ $t('editor.visitLink') }}
              </el-link>
              <el-button size="small" @click="copyLink(publishResult.data.url)">
                <el-icon><DocumentCopy /></el-icon>
                {{ copied ? $t('common.copied') : $t('common.copy') }}
              </el-button>
            </div>
          </div>
        </template>
      </el-alert>
      <el-alert v-else type="error" :closable="false" show-icon>
        <template #title>{{ $t('editor.publishFailed') }}</template>
        <template #default>{{ publishResult.error }}</template>
      </el-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Upload, Link, DocumentCopy } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import type { PublishRecord } from '../../../utils/storage';

const { t } = useI18n();

const props = defineProps<{
  nodeStatus: 'connected' | 'disconnected';
}>();

const emit = defineEmits(['update-count']);

const route = useRoute();
const router = useRouter();

const editingRecord = ref<PublishRecord | null>(null);
const publishing = ref(false);
const publishResult = ref<any>(null);
const copied = ref(false);

const form = ref({
  title: '',
  content: ''
});

const isEditing = computed(() => !!editingRecord.value);

const canPublish = computed(() => {
  return form.value.title.trim() && form.value.content.trim() && !publishing.value && props.nodeStatus === 'connected';
});

onMounted(async () => {
  if (route.params.id) {
    await loadRecord(route.params.id as string);
  }
});

watch(() => route.params.id, async (newId) => {
  if (newId) {
    await loadRecord(newId as string);
  } else {
    cancelEdit();
  }
});

async function loadRecord(id: string) {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getRecords' });
    if (response.success) {
      const record = response.data.find((r: PublishRecord) => r.id === id);
      if (record) {
        editingRecord.value = record;
        form.value.title = record.title;
        form.value.content = record.content;
      }
    }
  } catch (e) {
    console.error('Failed to load record:', e);
  }
}

function cancelEdit() {
  editingRecord.value = null;
  form.value.title = '';
  form.value.content = '';
  publishResult.value = null;
  router.push('/list');
}

async function handlePublish() {
  if (!canPublish.value) return;
  
  publishing.value = true;
  publishResult.value = null;
  
  try {
    const action = editingRecord.value ? 'republish' : 'publish';
    const payload: any = {
      action,
      title: form.value.title.trim(),
      content: form.value.content.trim()
    };
    
    if (editingRecord.value) {
      payload.id = editingRecord.value.id;
    }
    
    const response = await chrome.runtime.sendMessage(payload);
    publishResult.value = response;
    
    if (response.success) {
      form.value.title = '';
      form.value.content = '';
      editingRecord.value = null;
      
      // 更新记录数量
      const recordsResponse = await chrome.runtime.sendMessage({ action: 'getRecords' });
      if (recordsResponse.success) {
        emit('update-count', recordsResponse.data.length);
      }
      
      ElMessage.success(t('editor.publishSuccess'));
      
      // 跳转到列表页
      router.push('/list');
    }
  } catch (error: any) {
    publishResult.value = { success: false, error: error.message };
  } finally {
    publishing.value = false;
  }
}

async function copyLink(url: string) {
  await navigator.clipboard.writeText(url);
  copied.value = true;
  ElMessage.success(t('editor.linkCopied'));
  setTimeout(() => { copied.value = false; }, 2000);
}
</script>

<style scoped lang="less">
@primary: #F5D104;
@primary-dark: #D4B503;
@bg-dark: #1a1a2e;

.editor-view {
  max-width: 800px;
}

.page-header {
  margin-bottom: 24px;
  
  h2 {
    margin: 0 0 4px 0;
    font-size: 24px;
    color: #1a1a2e;
    font-weight: 600;
  }
  
  .subtitle {
    margin: 0;
    font-size: 14px;
    color: #6b7280;
  }
}

.editor-card {
  background: #fff;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
  
  .publish-btn {
    min-width: 160px;
    background: @primary;
    border-color: @primary;
    color: @bg-dark;
    font-weight: 600;
    
    &:hover {
      background: @primary-dark;
      border-color: @primary-dark;
    }
  }
}

.publish-result {
  margin-top: 20px;
  
  .result-content {
    margin-top: 8px;
    
    p {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: #374151;
      word-break: break-all;
    }
    
    .result-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }
}

// 媒体查询适配
@media (max-width: 1024px) {
  .page-header {
    h2 {
      font-size: 22px;
    }
  }
  
  .editor-card {
    padding: 24px;
  }
}

@media (max-width: 768px) {
  .page-header {
    margin-bottom: 20px;
    
    h2 {
      font-size: 20px;
    }
  }
  
  .editor-card {
    padding: 20px;
    border-radius: 12px;
  }
  
  .form-actions {
    flex-direction: column-reverse;
    
    .el-button {
      width: 100%;
    }
    
    .publish-btn {
      min-width: auto;
    }
  }
  
  .publish-result .result-content .result-actions {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .page-header {
    margin-bottom: 16px;
    
    h2 {
      font-size: 18px;
    }
    
    .subtitle {
      font-size: 12px;
    }
  }
  
  .editor-card {
    padding: 16px;
    border-radius: 10px;
  }
  
  .form-actions {
    margin-top: 16px;
    padding-top: 16px;
    gap: 10px;
  }
}
</style>
