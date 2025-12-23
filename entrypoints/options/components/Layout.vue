<template>
  <div class="app-layout">
    <!-- 左侧导航栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <img src="/icon/128.png" alt="IPFS Publisher" />
        </div>
        <h1>IPFS Publisher</h1>
      </div>
      
      <nav class="nav-menu">
        <router-link to="/editor" class="nav-item" active-class="active">
          <el-icon><Edit /></el-icon>
          <span>{{ $t('nav.editor') }}</span>
        </router-link>
        <router-link to="/list" class="nav-item" active-class="active">
          <el-icon><List /></el-icon>
          <span>{{ $t('nav.list') }}</span>
        </router-link>
        <router-link to="/settings" class="nav-item" active-class="active">
          <el-icon><Setting /></el-icon>
          <span>{{ $t('nav.settings') }}</span>
        </router-link>
      </nav>
      
      <div class="sidebar-footer">
        <div class="status-indicator" :class="nodeStatus">
          <span class="dot"></span>
          <span>{{ nodeStatus === 'connected' ? $t('nav.ipfsConnected') : $t('nav.ipfsDisconnected') }}</span>
        </div>
      </div>
    </aside>

    <!-- 右侧主内容区 -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <component :is="Component" :node-status="nodeStatus" @update-count="updateCount" />
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, provide } from 'vue';
import { Edit, List, Setting } from '@element-plus/icons-vue';

const nodeStatus = ref<'connected' | 'disconnected'>('disconnected');

// 提供给子组件使用
provide('nodeStatus', nodeStatus);

onMounted(async () => {
  await checkNode();
});

async function checkNode() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkNode' });
    nodeStatus.value = response.available ? 'connected' : 'disconnected';
  } catch {
    nodeStatus.value = 'disconnected';
  }
}
</script>

<style scoped lang="less">
@primary: #F5D104;
@primary-dark: #D4B503;
@bg-dark: #1a1a2e;
@bg-sidebar: #16213e;
@text-light: #ffffff;
@text-muted: #a0aec0;

.app-layout {
  display: flex;
  min-height: 100vh;
  background: #f8fafc;
}

// 左侧导航栏
.sidebar {
  width: 240px;
  background: @bg-sidebar;
  color: @text-light;
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100vh;
  left: 0;
  top: 0;
  
  .sidebar-header {
    padding: 24px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    
    .logo {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 12px;
      
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
    
    h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: @text-light;
    }
  }
  
  .nav-menu {
    flex: 1;
    padding: 16px 12px;
    
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 10px;
      cursor: pointer;
      color: @text-muted;
      transition: all 0.2s;
      margin-bottom: 4px;
      text-decoration: none;
      
      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: @text-light;
      }
      
      &.active {
        background: @primary;
        color: @bg-dark;
        font-weight: 600;
        
        .el-badge {
          --el-badge-bg-color: @bg-dark;
        }
      }
      
      .el-icon {
        font-size: 20px;
      }
      
      span {
        font-size: 14px;
      }
    }
  }
  
  .sidebar-footer {
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: @text-muted;
      
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ef4444;
      }
      
      &.connected .dot {
        background: #22c55e;
      }
    }
  }
}

// 右侧主内容
.main-content {
  flex: 1;
  margin-left: 240px;
  padding: 32px 40px;
  min-height: 100vh;
}

// 媒体查询适配
@media (max-width: 1024px) {
  .sidebar {
    width: 200px;
    
    .sidebar-header {
      padding: 20px 16px;
      
      .logo {
        width: 40px;
        height: 40px;
      }
      
      h1 {
        font-size: 16px;
      }
    }
    
    .nav-menu {
      padding: 12px 8px;
      
      .nav-item {
        padding: 12px 14px;
        gap: 10px;
        
        .el-icon {
          font-size: 18px;
        }
        
        span {
          font-size: 13px;
        }
      }
    }
  }
  
  .main-content {
    margin-left: 200px;
    padding: 24px 28px;
  }
}

@media (max-width: 768px) {
  .sidebar {
    width: 64px;
    
    .sidebar-header {
      padding: 16px 12px;
      
      .logo {
        width: 36px;
        height: 36px;
        margin-bottom: 0;
      }
      
      h1 {
        display: none;
      }
    }
    
    .nav-menu {
      padding: 12px 8px;
      
      .nav-item {
        padding: 12px;
        justify-content: center;
        
        span {
          display: none;
        }
        
        .el-badge {
          display: none;
        }
      }
    }
    
    .sidebar-footer {
      padding: 12px;
      
      .status-indicator {
        justify-content: center;
        
        span:not(.dot) {
          display: none;
        }
      }
    }
  }
  
  .main-content {
    margin-left: 64px;
    padding: 20px 16px;
  }
}

@media (max-width: 480px) {
  .sidebar {
    width: 56px;
    
    .sidebar-header {
      .logo {
        width: 32px;
        height: 32px;
      }
    }
    
    .nav-menu .nav-item {
      padding: 10px;
    }
  }
  
  .main-content {
    margin-left: 56px;
    padding: 16px 12px;
  }
}
</style>
