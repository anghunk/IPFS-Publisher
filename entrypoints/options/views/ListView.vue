<template>
  <div class="list-view">
    <div class="page-header">
      <div>
        <h2>{{ $t('list.title') }}</h2>
        <p class="subtitle">{{ $t('list.totalArticles', { count: records.length }) }}</p>
      </div>
      <el-button type="primary" @click="goToEditor" size="large"> {{ $t('list.newArticle') }} </el-button>
    </div>

    <div v-if="records.length === 0" class="empty-state">
      <el-empty :description="$t('list.emptyTitle')">
        <el-button type="primary" @click="goToEditor">{{ $t('list.publishNow') }}</el-button>
      </el-empty>
    </div>

    <div v-else class="record-grid">
      <div v-for="record in records" :key="record.id" class="record-card">
        <div class="card-header">
          <h3>{{ record.title }}</h3>
          <span class="card-date">{{ formatDate(record.createdAt) }}</span>
        </div>
        <p class="card-content">{{ truncate(record.content, 120) }}</p>
        <div class="card-footer">
          <a :href="getRecordUrl(record)" target="_blank" class="cid-link">
            <el-icon><Link /></el-icon>
            {{ record.cid.substring(0, 16) }}...
          </a>
          <div class="card-actions">
            <el-tooltip :content="$t('list.preview')">
              <el-button size="small" circle type="success" @click="previewRecord(record)">
                <el-icon><View /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip :content="$t('list.copyLink')">
              <el-button size="small" circle @click="copyLink(getRecordUrl(record))">
                <el-icon><DocumentCopy /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip :content="$t('common.edit')">
              <el-button size="small" circle type="primary" @click="editRecord(record)">
                <el-icon><Edit /></el-icon>
              </el-button>
            </el-tooltip>
            <el-popconfirm :title="$t('list.deleteConfirm')" @confirm="handleDelete(record.id)" width="200">
              <template #reference>
                <el-button size="small" circle type="danger">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { Plus, Link, DocumentCopy, Edit, Delete, View } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { useI18n } from 'vue-i18n';
import type { PublishRecord } from "../../../utils/storage";

const { t } = useI18n();

const emit = defineEmits(["update-count"]);
const router = useRouter();
const records = ref<PublishRecord[]>([]);
const gateway = ref('https://ipfs.io/ipfs/');

onMounted(async () => {
  await loadSettings();
  await loadRecords();
});

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
    if (response.success && response.data.gateway) {
      gateway.value = response.data.gateway;
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

// 动态生成 URL
function getRecordUrl(record: PublishRecord): string {
  return `${gateway.value}${record.cid}`;
}

async function loadRecords() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getRecords" });
    if (response.success) {
      records.value = response.data;
      emit("update-count", records.value.length);
    }
  } catch (e) {
    console.error("Failed to load records:", e);
  }
}

function goToEditor() {
  router.push("/editor");
}

function editRecord(record: PublishRecord) {
  router.push(`/editor/${record.id}`);
}

function previewRecord(record: PublishRecord) {
  router.push(`/preview/${record.id}`);
}

async function handleDelete(id: string) {
  try {
    const response = await chrome.runtime.sendMessage({ action: "deleteRecord", id });
    if (response.success) {
      await loadRecords();
      ElMessage.success(t('list.deleteSuccess'));
    }
  } catch (e) {
    ElMessage.error(t('list.deleteFailed'));
  }
}

async function copyLink(url: string) {
  await navigator.clipboard.writeText(url);
  ElMessage.success(t('editor.linkCopied'));
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN");
}

function truncate(text: string, length: number): string {
  return text.length > length ? text.substring(0, length) + "..." : text;
}
</script>

<style scoped lang="less">
@primary: #f5d104;
@primary-dark: #d4b503;

.page-header {
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;

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

.empty-state {
  background: #fff;
  border-radius: 16px;
  padding: 60px 40px;
  text-align: center;
}

.record-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.record-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  border: 1px solid #e5e7eb;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    border-color: @primary;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;

    h3 {
      margin: 0;
      font-size: 16px;
      color: #1a1a2e;
      font-weight: 600;
      flex: 1;
      line-height: 1.4;
    }

    .card-date {
      font-size: 12px;
      color: #9ca3af;
      white-space: nowrap;
      margin-left: 12px;
    }
  }

  .card-content {
    margin: 0 0 16px 0;
    font-size: 14px;
    color: #6b7280;
    line-height: 1.6;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid #f3f4f6;

    .cid-link {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: @primary-dark;
      text-decoration: none;

      &:hover {
        color: @primary;
      }
    }

    .card-actions {
      display: flex;
      gap: 6px;
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
  
  .record-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
  
  .record-card {
    padding: 16px;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    
    h2 {
      font-size: 20px;
    }
    
    .el-button {
      width: 100%;
    }
  }
  
  .record-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .record-card {
    padding: 14px;
    
    .card-header {
      flex-direction: column;
      gap: 4px;
      
      .card-date {
        margin-left: 0;
      }
    }
    
    .card-footer {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
      
      .card-actions {
        width: 100%;
        justify-content: flex-end;
      }
    }
  }
  
  .empty-state {
    padding: 40px 20px;
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
  
  .record-card {
    padding: 12px;
    border-radius: 10px;
    
    .card-header h3 {
      font-size: 14px;
    }
    
    .card-content {
      font-size: 13px;
      margin-bottom: 12px;
    }
  }
}
</style>
