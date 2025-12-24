<template>
  <div class="list-view">
    <!-- IPNS 提示横幅 -->
    <div v-if="!hasIpnsUrl && records.length > 0" class="ipns-banner">
      <div class="banner-content">
        <div class="banner-icon">📌</div>
        <div class="banner-text">
          <span class="banner-title">是否需要创建文章话题列表？</span>
          <span class="banner-desc">创建话题并发布到 IPNS，更新文章后链接不变</span>
        </div>
      </div>
      <el-button type="warning" size="small" @click="goToTopics">前往话题管理</el-button>
      <el-button text size="small" @click="dismissBanner" class="dismiss-btn"
        >不再提示</el-button
      >
    </div>

    <div class="page-header">
      <div>
        <h2>{{ $t("list.title") }}</h2>
        <p class="subtitle">
          共 {{ records.length }} 篇文章
          <span v-if="draftCount > 0" class="draft-count">（{{ draftCount }} 篇待发布）</span>
        </p>
      </div>
      <div class="header-actions">
        <el-button 
          v-if="draftCount > 0"
          type="warning" 
          @click="publishAllDrafts" 
          size="large"
          :loading="publishingAll"
        >
          {{ publishingAll ? `发布中 (${publishProgress})` : `一键发布全部 (${draftCount})` }}
        </el-button>
        <el-button type="primary" @click="goToEditor" size="large">
          {{ $t("list.newArticle") }}
        </el-button>
      </div>
    </div>

    <div v-if="records.length === 0" class="empty-state">
      <el-empty :description="$t('list.emptyTitle')">
        <el-button type="primary" @click="goToEditor">{{
          $t("list.publishNow")
        }}</el-button>
      </el-empty>
    </div>

    <div v-else class="record-grid">
      <div v-for="record in records" :key="record.id" class="record-card" :class="{ 'is-draft': record.status === 'draft' }">
        <div class="card-header">
          <div class="title-row">
            <h3>{{ record.title }}</h3>
            <!-- 发布状态标签 -->
            <el-tag 
              :type="getStatusType(record.status)" 
              size="small" 
              effect="light"
              class="status-tag"
            >
              {{ getStatusText(record.status) }}
            </el-tag>
          </div>
          <span class="card-date">{{ formatDate(record.createdAt) }}</span>
        </div>
        
        <!-- IPNS 永久链接状态 -->
        <div v-if="record.ipnsUrl && record.status === 'published'" class="ipns-status">
          <el-tag size="small" type="warning" effect="light">
            永久链接
          </el-tag>
          <a :href="record.ipnsUrl" target="_blank" class="ipns-link-small">
            {{ truncate(record.ipnsUrl, 30) }}
          </a>
          <el-button 
            size="small" 
            text 
            @click="copyLink(record.ipnsUrl)"
            class="copy-ipns-btn"
          >
            复制
          </el-button>
        </div>
        
        <!-- 错误信息 -->
        <div v-if="record.status === 'failed' && record.errorMessage" class="error-info">
          <el-icon><Warning /></el-icon>
          <span>{{ record.errorMessage }}</span>
        </div>
        
        <p class="card-content">{{ truncate(record.content, 120) }}</p>
        <div class="card-footer">
          <!-- 已发布：优先显示永久链接，否则显示 CID 链接 -->
          <a v-if="record.status === 'published' && record.ipnsUrl" :href="record.ipnsUrl" target="_blank" class="cid-link permanent-link">
            <el-icon><Link /></el-icon>
            永久链接
          </a>
          <a v-else-if="record.cid && record.status === 'published'" :href="getRecordUrl(record)" target="_blank" class="cid-link">
            <el-icon><Link /></el-icon>
            {{ record.cid.substring(0, 16) }}...
          </a>
          <!-- 未发布：显示草稿状态 -->
          <span v-else class="draft-label">
            <el-icon><Document /></el-icon>
            本地草稿
          </span>
          
          <div class="card-actions">
            <!-- 发布按钮（草稿或失败状态显示） -->
            <el-tooltip v-if="record.status === 'draft' || record.status === 'failed'" content="发布到 IPFS">
              <el-button
                size="small"
                circle
                type="warning"
                @click="publishSingleArticle(record)"
                :loading="publishingArticle === record.id"
              >
                <el-icon><Upload /></el-icon>
              </el-button>
            </el-tooltip>

            <el-tooltip v-if="record.status === 'published'" :content="$t('list.preview')">
              <el-button
                size="small"
                circle
                type="success"
                @click="previewRecord(record)"
              >
                <el-icon><View /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip v-if="record.status === 'published'" :content="record.ipnsUrl ? '复制永久链接' : $t('list.copyLink')">
              <el-button size="small" circle @click="copyLink(record.ipnsUrl || getRecordUrl(record))">
                <el-icon><DocumentCopy /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip :content="$t('common.edit')">
              <el-button size="small" circle type="primary" @click="editRecord(record)">
                <el-icon><Edit /></el-icon>
              </el-button>
            </el-tooltip>
            <el-popconfirm
              :title="$t('list.deleteConfirm')"
              @confirm="handleDelete(record.id)"
              width="200"
            >
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
import { Plus, Link, DocumentCopy, Edit, Delete, View, Upload, Document, Warning } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import type { PublishRecord } from "../../../utils/storage";

const { t } = useI18n();

const emit = defineEmits(["update-count"]);
const router = useRouter();
const records = ref<PublishRecord[]>([]);
const gateway = ref("https://ipfs.io/ipfs/");
const hasIpnsUrl = ref(false);
const bannerDismissed = ref(false);

const publishingArticle = ref<string | null>(null);
const publishingAll = ref(false);
const publishProgress = ref("");

// 计算待发布数量
const draftCount = computed(() => {
  return records.value.filter(r => r.status === 'draft' || r.status === 'failed').length;
});

onMounted(async () => {
  await loadSettings();
  await loadRecords();
  await checkBannerDismissed();
});

async function checkBannerDismissed() {
  try {
    const result = await chrome.storage.local.get("ipnsBannerDismissed");
    bannerDismissed.value = result.ipnsBannerDismissed || false;
  } catch (e) {
    console.error("Failed to check banner status:", e);
  }
}

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getSettings" });
    if (response.success && response.data) {
      if (response.data.gateway) {
        gateway.value = response.data.gateway;
      }
      hasIpnsUrl.value = !!response.data.ipnsUrl;
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
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

function goToTopics() {
  router.push("/topics");
}

async function dismissBanner() {
  bannerDismissed.value = true;
  hasIpnsUrl.value = true; // 隐藏横幅
  try {
    await chrome.storage.local.set({ ipnsBannerDismissed: true });
  } catch (e) {
    console.error("Failed to save banner status:", e);
  }
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
      ElMessage.success(t("list.deleteSuccess"));
    }
  } catch (e) {
    ElMessage.error(t("list.deleteFailed"));
  }
}

async function copyLink(url: string) {
  await navigator.clipboard.writeText(url);
  ElMessage.success(t("editor.linkCopied"));
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN");
}

function truncate(text: string, length: number): string {
  return text.length > length ? text.substring(0, length) + "..." : text;
}

// 获取状态标签类型
function getStatusType(status: string): string {
  const types: Record<string, string> = {
    draft: 'info',
    publishing: 'warning',
    published: 'success',
    failed: 'danger',
  };
  return types[status] || 'info';
}

// 获取状态文本
function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    draft: '草稿',
    publishing: '发布中',
    published: '已发布',
    failed: '发布失败',
  };
  return texts[status] || '未知';
}

// 发布单篇文章到 IPFS
async function publishSingleArticle(record: PublishRecord) {
  // 检查是否是重新发布（之前已有 ipnsUrl）
  const isRepublish = !!record.ipnsUrl;
  
  publishingArticle.value = record.id;
  try {
    const response = await chrome.runtime.sendMessage({
      action: "publishArticle",
      id: record.id,
    });

    if (response.success) {
      // 重新加载记录
      await loadRecords();
      
      if (response.data.ipnsUrl) {
        if (isRepublish) {
          // 重新发布，提示 IPNS 传播延迟
          ElMessage({
            type: 'success',
            message: '文章已更新发布！永久链接内容将在约 5 分钟后更新（IPNS 网络传播需要时间）',
            duration: 5000,
          });
        } else {
          ElMessage.success("文章发布成功，已生成永久链接！");
        }
      } else {
        ElMessage.success("文章发布成功！");
      }
    } else {
      throw new Error(response.error);
    }
  } catch (error: any) {
    ElMessage.error("发布失败: " + error.message);
    await loadRecords(); // 刷新状态
  } finally {
    publishingArticle.value = null;
  }
}

// 批量发布所有草稿
async function publishAllDrafts() {
  publishingAll.value = true;
  const total = draftCount.value;
  
  // 检查是否有重新发布的文章
  const hasRepublish = records.value.some(r => 
    (r.status === 'draft' || r.status === 'failed') && r.ipnsUrl
  );
  
  try {
    publishProgress.value = `0/${total}`;
    
    const response = await chrome.runtime.sendMessage({
      action: "publishAllArticles",
    });

    if (response.success) {
      const { published, failed } = response.data;
      await loadRecords();
      
      if (failed > 0) {
        ElMessage.warning(`发布完成：${published} 篇成功，${failed} 篇失败`);
      } else if (hasRepublish) {
        // 有重新发布的文章，提示 IPNS 传播延迟
        ElMessage({
          type: 'success',
          message: `成功发布 ${published} 篇文章！永久链接内容将在约 5 分钟后更新`,
          duration: 5000,
        });
      } else {
        ElMessage.success(`成功发布 ${published} 篇文章！`);
      }
    } else {
      throw new Error(response.error);
    }
  } catch (error: any) {
    ElMessage.error("批量发布失败: " + error.message);
    await loadRecords();
  } finally {
    publishingAll.value = false;
    publishProgress.value = "";
  }
}


</script>

<style scoped lang="less">
@primary: #f5d104;
@primary-dark: #d4b503;

.ipns-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
  border-radius: 12px;
  border: 1px solid @primary;

  .banner-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;

    .banner-icon {
      font-size: 24px;
    }

    .banner-text {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .banner-title {
        font-size: 14px;
        font-weight: 600;
        color: #1a1a2e;
      }

      .banner-desc {
        font-size: 12px;
        color: #6b7280;
      }
    }
  }

  .dismiss-btn {
    color: #9ca3af;

    &:hover {
      color: #6b7280;
    }
  }
}

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
    
    .draft-count {
      color: @primary-dark;
      font-weight: 500;
    }
  }
  
  .header-actions {
    display: flex;
    gap: 12px;
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
  
  &.is-draft {
    border-left: 3px solid #9ca3af;
  }

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    border-color: @primary;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    
    .title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      
      h3 {
        margin: 0;
        font-size: 16px;
        color: #1a1a2e;
        font-weight: 600;
        line-height: 1.4;
      }
      
      .status-tag {
        flex-shrink: 0;
      }
    }

    .card-date {
      font-size: 12px;
      color: #9ca3af;
      white-space: nowrap;
      margin-left: 12px;
    }
  }
  
  .error-info {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    margin-bottom: 12px;
    background: #fef2f2;
    border-radius: 6px;
    border: 1px solid #fecaca;
    color: #dc2626;
    font-size: 12px;
  }
  
  .draft-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #9ca3af;
  }

  .ipns-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    margin-bottom: 12px;
    background: #fffbeb;
    border-radius: 6px;
    border: 1px solid #fde68a;
    
    .tag-icon {
      margin-right: 2px;
    }
    
    .ipns-link-small {
      flex: 1;
      font-size: 11px;
      color: @primary-dark;
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      
      &:hover {
        text-decoration: underline;
      }
    }
    
    .copy-ipns-btn {
      font-size: 11px;
      padding: 2px 6px;
      color: #9ca3af;
      
      &:hover {
        color: @primary-dark;
      }
    }
  }

  .card-content {
    margin: 0 0 16px 0;
    font-size: 14px;
    color: #6b7280;
    line-height: 1.6;
    word-break: break-all;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid #f3f4f6;

    .permanent-link {
      color: @primary-dark;
      font-weight: 500;
    }

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
