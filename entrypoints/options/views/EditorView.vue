<template>
  <div class="editor-view">
    <div class="page-header">
      <h2>{{ isEditing ? $t("editor.editTitle") : $t("editor.title") }}</h2>
      <p class="subtitle">{{ $t("editor.subtitle") }}</p>
    </div>

    <div class="editor-card">
      <el-form :model="form" label-position="top">
        <el-form-item :label="$t('editor.articleTitle')">
          <el-input
            v-model="form.title"
            :placeholder="$t('editor.titlePlaceholder')"
            :disabled="saving"
            size="large"
          />
        </el-form-item>

        <el-form-item :label="$t('editor.articleContent')">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="16"
            :placeholder="$t('editor.contentPlaceholder')"
            :disabled="saving"
          />
        </el-form-item>
      </el-form>

      <div class="form-actions">
        <el-button @click="cancelEdit" size="large">
          {{ $t("common.cancel") }}
        </el-button>
        <el-button
          :loading="saving"
          :disabled="!canSave"
          @click="handleSaveDraft"
          size="large"
        >
          {{ saving ? "保存中..." : "保存草稿" }}
        </el-button>
        <el-button
          type="primary"
          :loading="publishing"
          :disabled="!canSave"
          @click="handlePublish"
          size="large"
          class="publish-btn"
        >
          {{ publishing ? "发布中..." : "直接发布" }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import type { PublishRecord } from "../../../utils/storage";

const { t } = useI18n();

const emit = defineEmits(["update-count"]);

const route = useRoute();
const router = useRouter();

const editingRecord = ref<PublishRecord | null>(null);
const saving = ref(false);
const publishing = ref(false);

const form = ref({
  title: "",
  content: "",
});

const isEditing = computed(() => !!editingRecord.value);

const canSave = computed(() => {
  return form.value.title.trim() && form.value.content.trim() && !saving.value;
});

onMounted(async () => {
  if (route.params.id) {
    await loadRecord(route.params.id as string);
  }
});

watch(
  () => route.params.id,
  async (newId) => {
    if (newId) {
      await loadRecord(newId as string);
    } else {
      cancelEdit();
    }
  }
);

async function loadRecord(id: string) {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getRecords" });
    if (response.success) {
      const record = response.data.find((r: PublishRecord) => r.id === id);
      if (record) {
        editingRecord.value = record;
        form.value.title = record.title;
        form.value.content = record.content;
      }
    }
  } catch (e) {
    console.error("Failed to load record:", e);
  }
}

function cancelEdit() {
  editingRecord.value = null;
  form.value.title = "";
  form.value.content = "";
  router.push("/list");
}

function goToList() {
  router.push("/list");
}

async function handleSaveDraft() {
  if (!canSave.value) return;

  saving.value = true;

  try {
    const payload: any = {
      action: "save",
      title: form.value.title.trim(),
      content: form.value.content.trim(),
    };

    if (editingRecord.value) {
      payload.id = editingRecord.value.id;
    }

    const response = await chrome.runtime.sendMessage(payload);

    if (response.success) {
      // 直接跳转到列表
      router.push("/list");
    } else {
      throw new Error(response.error);
    }
  } catch (error: any) {
    ElMessage.error("保存失败: " + error.message);
  } finally {
    saving.value = false;
  }
}

async function handlePublish() {
  if (!canSave.value) return;

  // 检查是否是重新发布（之前已有 ipnsUrl）
  const isRepublish = !!(editingRecord.value?.ipnsUrl);
  
  publishing.value = true;

  try {
    // 先保存
    const savePayload: any = {
      action: "save",
      title: form.value.title.trim(),
      content: form.value.content.trim(),
    };

    if (editingRecord.value) {
      savePayload.id = editingRecord.value.id;
    }

    const saveResponse = await chrome.runtime.sendMessage(savePayload);

    if (!saveResponse.success) {
      throw new Error(saveResponse.error);
    }

    // 然后发布
    const publishResponse = await chrome.runtime.sendMessage({
      action: "publishArticle",
      id: saveResponse.data.id,
    });

    if (publishResponse.success) {
      if (isRepublish && publishResponse.data.ipnsUrl) {
        // 重新发布，提示 IPNS 传播延迟
        ElMessage({
          type: 'success',
          message: '文章已更新发布！永久链接内容将在约 5 分钟后更新',
          duration: 5000,
        });
      } else {
        ElMessage.success("文章发布成功！");
      }
      router.push("/list");
    } else {
      throw new Error(publishResponse.error);
    }
  } catch (error: any) {
    ElMessage.error("发布失败: " + error.message);
  } finally {
    publishing.value = false;
  }
}
</script>

<style scoped lang="less">
@primary: #f5d104;
@primary-dark: #d4b503;
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
    min-width: 120px;
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
