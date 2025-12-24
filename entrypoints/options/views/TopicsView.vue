<template>
  <div class="topics-view">
    <div class="page-header">
      <div>
        <h2>{{ $t("topics.title") }}</h2>
        <p class="subtitle">{{ $t("topics.subtitle") }}</p>
      </div>
      <el-button type="primary" @click="showCreateDialog = true" size="large">
        <el-icon><Plus /></el-icon>
        {{ $t("topics.createTopic") }}
      </el-button>
    </div>

    <!-- 话题列表 -->
    <div v-if="topics.length === 0" class="empty-state">
      <el-empty :description="$t('topics.emptyTitle')">
        <el-button type="primary" @click="showCreateDialog = true">
          {{ $t("topics.createFirst") }}
        </el-button>
      </el-empty>
    </div>

    <div v-else class="topics-grid">
      <div v-for="topic in topics" :key="topic.id" class="topic-card">
        <div class="card-header">
          <div class="topic-info">
            <h3>{{ topic.name }}</h3>
            <span class="article-count">{{ topic.articleIds.length }} 篇文章</span>
          </div>
          <div class="card-actions">
            <el-tooltip content="编辑话题">
              <el-button size="small" circle @click="editTopic(topic)">
                <el-icon><Edit /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="管理文章">
              <el-button size="small" circle type="primary" @click="manageArticles(topic)">
                <el-icon><Document /></el-icon>
              </el-button>
            </el-tooltip>
            <el-popconfirm
              title="确定删除这个话题？"
              @confirm="handleDeleteTopic(topic.id)"
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

        <p v-if="topic.description" class="topic-desc">{{ topic.description }}</p>
        <p v-if="topic.author" class="topic-author">作者：{{ topic.author }}</p>

        <!-- IPNS 发布状态 -->
        <div v-if="topic.ipnsUrl" class="ipns-status">
          <el-tag size="small" type="warning" effect="light">永久链接</el-tag>
          <a :href="topic.ipnsUrl" target="_blank" class="ipns-link">
            {{ truncate(topic.ipnsUrl, 35) }}
          </a>
          <el-button size="small" text @click="copyLink(topic.ipnsUrl)" class="copy-btn">
            复制
          </el-button>
        </div>

        <div class="card-footer">
          <span class="update-time">
            {{ topic.lastPublishedAt ? `发布于 ${formatDate(topic.lastPublishedAt)}` : "未发布" }}
          </span>
          <el-button
            type="warning"
            size="small"
            @click="publishTopic(topic)"
            :loading="publishingTopic === topic.id"
          >
            <el-icon><Upload /></el-icon>
            {{ topic.ipnsUrl ? "更新发布" : "发布到 IPNS" }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- 创建/编辑话题对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingTopic ? '编辑话题' : '创建话题'"
      width="500px"
    >
      <el-form :model="topicForm" label-position="top">
        <el-form-item label="话题名称" required>
          <el-input v-model="topicForm.name" placeholder="例如：技术博客、旅行日记" />
        </el-form-item>
        <el-form-item label="话题描述">
          <el-input
            v-model="topicForm.description"
            type="textarea"
            :rows="3"
            placeholder="简单介绍这个话题的内容"
          />
        </el-form-item>
        <el-form-item label="作者">
          <el-input v-model="topicForm.author" placeholder="作者名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeCreateDialog">取消</el-button>
        <el-button type="primary" @click="handleSaveTopic" :loading="saving">
          {{ editingTopic ? "保存" : "创建" }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 管理文章对话框 -->
    <el-dialog v-model="showArticleDialog" title="管理文章" width="700px">
      <div v-if="currentTopic" class="article-manager">
        <div class="manager-header">
          <h4>{{ currentTopic.name }}</h4>
          <span class="selected-count">已选 {{ currentTopic.articleIds.length }} 篇</span>
        </div>

        <div v-if="allArticles.length === 0" class="no-articles">
          <el-empty description="还没有发布过文章，请先去发布文章" :image-size="80" />
        </div>

        <div v-else class="article-list">
          <div
            v-for="article in allArticles"
            :key="article.id"
            class="article-item"
            :class="{ selected: isArticleSelected(article.id) }"
            @click="toggleArticle(article.id)"
          >
            <el-checkbox :model-value="isArticleSelected(article.id)" @click.stop />
            <div class="article-info">
              <span class="article-title">{{ article.title }}</span>
              <span class="article-meta">
                {{ article.status === "published" ? "已发布" : "草稿" }} ·
                {{ formatDate(article.createdAt) }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showArticleDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Plus, Edit, Delete, Document, Upload } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import type { TopicList } from "../../../utils/storage";
import type { PublishRecord } from "../../../utils/storage";

const { t } = useI18n();

const topics = ref<TopicList[]>([]);
const allArticles = ref<PublishRecord[]>([]);
const showCreateDialog = ref(false);
const showArticleDialog = ref(false);
const editingTopic = ref<TopicList | null>(null);
const currentTopic = ref<TopicList | null>(null);
const saving = ref(false);
const publishingTopic = ref<string | null>(null);

const topicForm = ref({
  name: "",
  description: "",
  author: "",
});

onMounted(async () => {
  await loadTopics();
  await loadArticles();
});

async function loadTopics() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getTopics" });
    if (response.success) {
      topics.value = response.data;
    }
  } catch (e) {
    console.error("Failed to load topics:", e);
  }
}

async function loadArticles() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getRecords" });
    if (response.success) {
      allArticles.value = response.data;
    }
  } catch (e) {
    console.error("Failed to load articles:", e);
  }
}

function editTopic(topic: TopicList) {
  editingTopic.value = topic;
  topicForm.value = {
    name: topic.name,
    description: topic.description || "",
    author: topic.author || "",
  };
  showCreateDialog.value = true;
}

function manageArticles(topic: TopicList) {
  currentTopic.value = { ...topic };
  showArticleDialog.value = true;
}

function closeCreateDialog() {
  showCreateDialog.value = false;
  editingTopic.value = null;
  topicForm.value = { name: "", description: "", author: "" };
}

async function handleSaveTopic() {
  if (!topicForm.value.name.trim()) {
    ElMessage.warning("请输入话题名称");
    return;
  }

  saving.value = true;
  try {
    if (editingTopic.value) {
      // 更新话题
      const response = await chrome.runtime.sendMessage({
        action: "updateTopic",
        id: editingTopic.value.id,
        data: topicForm.value,
      });
      if (response.success) {
        ElMessage.success("话题已更新");
      } else {
        throw new Error(response.error);
      }
    } else {
      // 创建话题
      const response = await chrome.runtime.sendMessage({
        action: "createTopic",
        data: topicForm.value,
      });
      if (response.success) {
        ElMessage.success("话题已创建");
      } else {
        throw new Error(response.error);
      }
    }
    await loadTopics();
    closeCreateDialog();
  } catch (error: any) {
    ElMessage.error("操作失败: " + error.message);
  } finally {
    saving.value = false;
  }
}

async function handleDeleteTopic(id: string) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "deleteTopic",
      id,
    });
    if (response.success) {
      ElMessage.success("话题已删除");
      await loadTopics();
    }
  } catch (error: any) {
    ElMessage.error("删除失败: " + error.message);
  }
}

function isArticleSelected(articleId: string): boolean {
  return currentTopic.value?.articleIds.includes(articleId) || false;
}

async function toggleArticle(articleId: string) {
  if (!currentTopic.value) return;

  const isSelected = isArticleSelected(articleId);
  try {
    if (isSelected) {
      // 从话题移除文章
      await chrome.runtime.sendMessage({
        action: "removeArticleFromTopic",
        topicId: currentTopic.value.id,
        articleId,
      });
      currentTopic.value.articleIds = currentTopic.value.articleIds.filter(
        (id) => id !== articleId
      );
    } else {
      // 向话题添加文章
      await chrome.runtime.sendMessage({
        action: "addArticleToTopic",
        topicId: currentTopic.value.id,
        articleId,
      });
      currentTopic.value.articleIds.push(articleId);
    }
    // 同步更新主列表
    await loadTopics();
  } catch (error: any) {
    ElMessage.error("操作失败: " + error.message);
  }
}

async function publishTopic(topic: TopicList) {
  if (topic.articleIds.length === 0) {
    ElMessage.warning("请先添加文章到话题中");
    return;
  }

  // 检查是否有已发布的文章
  const publishedCount = allArticles.value.filter(
    (a) => topic.articleIds.includes(a.id) && a.status === "published"
  ).length;

  if (publishedCount === 0) {
    ElMessage.warning("话题中没有已发布的文章，请先发布文章");
    return;
  }

  const isRepublish = !!topic.ipnsUrl;
  publishingTopic.value = topic.id;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "publishTopicToIpns",
      topicId: topic.id,
    });

    if (response.success) {
      await loadTopics();
      if (isRepublish) {
        ElMessage({
          type: "success",
          message: "话题已更新发布！永久链接内容将在约 5 分钟后更新",
          duration: 5000,
        });
      } else {
        ElMessage.success("话题发布成功，已生成永久链接！");
      }
    } else {
      throw new Error(response.error);
    }
  } catch (error: any) {
    ElMessage.error("发布失败: " + error.message);
  } finally {
    publishingTopic.value = null;
  }
}

async function copyLink(url: string) {
  await navigator.clipboard.writeText(url);
  ElMessage.success("链接已复制");
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string, length: number): string {
  return text.length > length ? text.substring(0, length) + "..." : text;
}
</script>

<style scoped lang="less">
@primary: #f5d104;
@primary-dark: #d4b503;

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.empty-state {
  background: #fff;
  border-radius: 16px;
  padding: 60px 40px;
  text-align: center;
}

.topics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 20px;
}

.topic-card {
  background: #fff;
  border-radius: 14px;
  padding: 24px;
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

    .topic-info {
      h3 {
        margin: 0 0 4px 0;
        font-size: 18px;
        color: #1a1a2e;
        font-weight: 600;
      }

      .article-count {
        font-size: 13px;
        color: #9ca3af;
      }
    }

    .card-actions {
      display: flex;
      gap: 6px;
    }
  }

  .topic-desc {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: #6b7280;
    line-height: 1.5;
  }

  .topic-author {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: #9ca3af;
  }

  .ipns-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    margin-bottom: 16px;
    background: #fffbeb;
    border-radius: 8px;
    border: 1px solid #fde68a;

    .ipns-link {
      flex: 1;
      font-size: 12px;
      color: @primary-dark;
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &:hover {
        text-decoration: underline;
      }
    }

    .copy-btn {
      font-size: 12px;
      color: #9ca3af;
      padding: 2px 6px;

      &:hover {
        color: @primary-dark;
      }
    }
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    border-top: 1px solid #f3f4f6;

    .update-time {
      font-size: 12px;
      color: #9ca3af;
    }
  }
}

// 文章管理对话框
.article-manager {
  .manager-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;

    h4 {
      margin: 0;
      font-size: 16px;
      color: #1a1a2e;
    }

    .selected-count {
      font-size: 13px;
      color: @primary-dark;
      background: #fefce8;
      padding: 4px 10px;
      border-radius: 12px;
    }
  }

  .no-articles {
    padding: 40px 0;
  }

  .article-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .article-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid transparent;

    &:hover {
      background: #f9fafb;
    }

    &.selected {
      background: #fefce8;
      border-color: @primary;
    }

    .article-info {
      flex: 1;
      min-width: 0;

      .article-title {
        display: block;
        font-size: 14px;
        color: #1a1a2e;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .article-meta {
        font-size: 12px;
        color: #9ca3af;
        margin-top: 2px;
      }
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;

    .el-button {
      width: 100%;
    }
  }

  .topics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
