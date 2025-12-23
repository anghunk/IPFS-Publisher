<template>
  <div class="preview-view">
    <div class="page-header">
      <div class="header-left">
        <el-button @click="goBack" size="large">
          <el-icon><ArrowLeft /></el-icon>
          {{ $t('preview.backToList') }}
        </el-button>
      </div>
      <div class="header-actions">
        <el-button @click="copyLink" size="large">
          <el-icon><DocumentCopy /></el-icon>
          {{ $t('preview.copyLink') }}
        </el-button>
        <el-button type="primary" @click="openLink" size="large">
          <el-icon><Link /></el-icon>
          {{ $t('preview.visitIpfs') }}
        </el-button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="10" animated />
    </div>

    <div v-else-if="record" class="article-container">
      <article class="article-card">
        <header class="article-header">
          <h1>{{ record.title }}</h1>
          <div class="article-meta">
            <span class="meta-item">
              <el-icon><Calendar /></el-icon>
              {{ formatDate(record.createdAt) }}
            </span>
            <span class="meta-item cid">
              <el-icon><Link /></el-icon>
              {{ record.cid }}
            </span>
          </div>
        </header>
        <div class="article-content markdown-body" v-html="renderedContent"></div>
      </article>
    </div>

    <div v-else class="empty-state">
      <el-empty :description="$t('preview.articleNotFound')">
        <el-button type="primary" @click="goBack">{{ $t('preview.backToList') }}</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Link, DocumentCopy, Calendar } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { marked } from 'marked';
import type { PublishRecord } from '../../../utils/storage';

const { t } = useI18n();

const route = useRoute();
const router = useRouter();
const record = ref<PublishRecord | null>(null);
const loading = ref(true);

const renderedContent = computed(() => {
  if (!record.value) return '';
  return marked.parse(record.value.content) as string;
});

onMounted(async () => {
  await loadRecord();
});

async function loadRecord() {
  loading.value = true;
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getRecords' });
    if (response.success) {
      const id = route.params.id as string;
      record.value = response.data.find((r: PublishRecord) => r.id === id) || null;
    }
  } catch (e) {
    console.error('Failed to load record:', e);
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.push('/list');
}

function openLink() {
  if (record.value) {
    window.open(record.value.url, '_blank');
  }
}

async function copyLink() {
  if (record.value) {
    await navigator.clipboard.writeText(record.value.url);
    ElMessage.success(t('preview.linkCopied'));
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}
</script>

<style scoped lang="less">
@primary: #F5D104;
@primary-dark: #D4B503;
@bg-dark: #1a1a2e;

.preview-view {
  max-width: 900px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.loading-state {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
}

.article-container {
  .article-card {
    background: #fff;
    border-radius: 16px;
    padding: 40px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  }
  
  .article-header {
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid #e5e7eb;
    
    h1 {
      margin: 0 0 16px 0;
      font-size: 28px;
      font-weight: 700;
      color: @bg-dark;
      line-height: 1.4;
    }
    
    .article-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      
      .meta-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: #6b7280;
        
        &.cid {
          font-family: monospace;
          font-size: 12px;
          color: @primary-dark;
        }
      }
    }
  }
  
  .article-content {
    font-size: 16px;
    line-height: 1.8;
    color: #374151;
  }
}

.empty-state {
  background: #fff;
  border-radius: 16px;
  padding: 60px 40px;
  text-align: center;
}

// Markdown 渲染样式
.markdown-body {
  :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    color: @bg-dark;
    line-height: 1.4;
  }
  
  :deep(h1) { font-size: 2em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
  :deep(h2) { font-size: 1.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
  :deep(h3) { font-size: 1.25em; }
  :deep(h4) { font-size: 1em; }
  
  :deep(p) {
    margin: 0 0 16px 0;
  }
  
  :deep(a) {
    color: @primary-dark;
    text-decoration: none;
    
    &:hover {
      color: @primary;
      text-decoration: underline;
    }
  }
  
  :deep(code) {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.9em;
    color: #ef4444;
  }
  
  :deep(pre) {
    background: #1f2937;
    color: #e5e7eb;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 16px 0;
    
    code {
      background: none;
      color: inherit;
      padding: 0;
    }
  }
  
  :deep(blockquote) {
    margin: 16px 0;
    padding: 12px 20px;
    border-left: 4px solid @primary;
    background: #fefce8;
    color: #6b7280;
    
    p:last-child {
      margin-bottom: 0;
    }
  }
  
  :deep(ul), :deep(ol) {
    margin: 16px 0;
    padding-left: 2em;
  }
  
  :deep(li) {
    margin: 8px 0;
  }
  
  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    
    th, td {
      border: 1px solid #e5e7eb;
      padding: 10px 14px;
      text-align: left;
    }
    
    th {
      background: #f9fafb;
      font-weight: 600;
    }
    
    tr:nth-child(even) {
      background: #f9fafb;
    }
  }
  
  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 16px 0;
  }
  
  :deep(hr) {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 24px 0;
  }
}

// 媒体查询适配
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
    
    .header-left,
    .header-actions {
      width: 100%;
    }
    
    .header-actions {
      justify-content: flex-end;
    }
  }
  
  .article-card {
    padding: 24px !important;
    
    .article-header {
      h1 {
        font-size: 22px;
      }
      
      .article-meta {
        flex-direction: column;
        gap: 8px;
      }
    }
  }
  
  .markdown-body {
    font-size: 15px;
  }
}

@media (max-width: 480px) {
  .article-card {
    padding: 16px !important;
    border-radius: 12px !important;
    
    .article-header {
      margin-bottom: 20px;
      padding-bottom: 16px;
      
      h1 {
        font-size: 20px;
      }
    }
  }
}
</style>
