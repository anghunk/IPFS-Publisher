import { uploadToIpfs, checkIpfsNode } from '../utils/ipfs';
import { addRecord, getRecords, getRecord, updateRecord, deleteRecord } from '../utils/storage';
import { generateHtmlPage } from '../utils/template';

// 定义消息类型接口
interface PublishMessage {
  action: 'publish';
  title: string;
  content: string;
}

interface RepublishMessage {
  action: 'republish';
  id: string;
  title: string;
  content: string;
}

interface CheckNodeMessage {
  action: 'checkNode';
}

interface RecordMessage {
  action: 'getRecords' | 'getRecord' | 'deleteRecord';
  id?: string;
}

type Message = PublishMessage | RepublishMessage | CheckNodeMessage | RecordMessage | { action: string; [key: string]: any };

export default defineBackground(() => {
  console.log('IPFS Publisher Background Service Started!', { id: browser.runtime.id });
});

const browserAPI = (typeof browser !== 'undefined' ? browser : chrome);

// 处理 IPFS 发布请求
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
  if (request.action === 'publish') {
    const { title, content } = request as PublishMessage;
    
    (async () => {
      try {
        // 生成带样式的 HTML 页面
        const htmlContent = generateHtmlPage(title, content, Date.now());
        const filename = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.html`;
        
        // 调试日志
        console.log('[IPFS Publisher] 发布操作 - 生成 HTML');
        console.log('[IPFS Publisher] HTML 内容长度:', htmlContent.length);
        console.log('[IPFS Publisher] 是否包含 DOCTYPE:', htmlContent.includes('<!DOCTYPE html>'));

        const result = await uploadToIpfs(htmlContent, filename, 'text/html');
        
        // 保存到历史记录
        const record = await addRecord({
          title,
          content,
          cid: result.cid,
          url: result.url,
        });
        
        sendResponse({ success: true, data: { ...result, record } });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  }
});

// 处理重新发布（编辑后重新上传）
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
  if (request.action === 'republish') {
    const { id, title, content } = request as RepublishMessage;
    
    (async () => {
      try {
        // 生成带样式的 HTML 页面
        const htmlContent = generateHtmlPage(title, content, Date.now());
        const filename = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.html`;

        const result = await uploadToIpfs(htmlContent, filename, 'text/html');
        
        // 更新记录
        const record = await updateRecord(id, {
          title,
          content,
          cid: result.cid,
          url: result.url,
        });
        
        sendResponse({ success: true, data: { ...result, record } });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  }
});

// 获取所有记录
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
  if (request.action === 'getRecords') {
    (async () => {
      try {
        const records = await getRecords();
        sendResponse({ success: true, data: records });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

// 获取单条记录
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
  if (request.action === 'getRecord') {
    const { id } = request as RecordMessage;
    (async () => {
      try {
        const record = await getRecord(id!);
        sendResponse({ success: true, data: record });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

// 删除记录
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
  if (request.action === 'deleteRecord') {
    const { id } = request as RecordMessage;
    (async () => {
      try {
        await deleteRecord(id!);
        sendResponse({ success: true });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

// 检查 IPFS 节点状态
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
  if (request.action === 'checkNode') {
    (async () => {
      try {
        const available = await checkIpfsNode();
        sendResponse({ success: true, available });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  }
});

// 进入 options 页面
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
  if (request.action === 'open_options_page') {
    const extensionURL = browserAPI.runtime.getURL('options.html');
    browserAPI.tabs.create({ url: extensionURL });
  }
});

// WebDAV 代理请求 (保留原有功能)
browserAPI.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
  if (request.type === 'webdav') {
    const { method, url, headers, data } = request;
    
    fetch(url, {
      method: method,
      headers: headers,
      body: data || undefined
    })
    .then(async response => {
      const text = await response.text();
      sendResponse({
        status: response.status,
        statusText: response.statusText,
        data: text
      });
    })
    .catch(error => {
      sendResponse({
        error: error.message
      });
    });
    
    return true;
  }
});