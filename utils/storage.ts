/**
 * 发布列表存储服务
 */

export interface PublishRecord {
  id: string;
  title: string;
  content: string;
  cid: string;
  url: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'publishHistory';

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 获取所有发布记录
 */
export async function getRecords(): Promise<PublishRecord[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

/**
 * 获取单条记录
 */
export async function getRecord(id: string): Promise<PublishRecord | null> {
  const records = await getRecords();
  return records.find(r => r.id === id) || null;
}

/**
 * 添加记录
 */
export async function addRecord(data: {
  title: string;
  content: string;
  cid: string;
  url: string;
}): Promise<PublishRecord> {
  const records = await getRecords();
  const now = Date.now();
  
  const newRecord: PublishRecord = {
    id: generateId(),
    title: data.title,
    content: data.content,
    cid: data.cid,
    url: data.url,
    createdAt: now,
    updatedAt: now,
  };
  
  records.unshift(newRecord); // 新记录放在最前面
  await chrome.storage.local.set({ [STORAGE_KEY]: records });
  
  return newRecord;
}

/**
 * 更新记录
 */
export async function updateRecord(id: string, data: {
  title?: string;
  content?: string;
  cid?: string;
  url?: string;
}): Promise<PublishRecord | null> {
  const records = await getRecords();
  const index = records.findIndex(r => r.id === id);
  
  if (index === -1) return null;
  
  records[index] = {
    ...records[index],
    ...data,
    updatedAt: Date.now(),
  };
  
  await chrome.storage.local.set({ [STORAGE_KEY]: records });
  return records[index];
}

/**
 * 删除记录
 */
export async function deleteRecord(id: string): Promise<boolean> {
  const records = await getRecords();
  const index = records.findIndex(r => r.id === id);
  
  if (index === -1) return false;
  
  records.splice(index, 1);
  await chrome.storage.local.set({ [STORAGE_KEY]: records });
  
  return true;
}

/**
 * 清空所有记录
 */
export async function clearRecords(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}

// ============ 设置存储 ============

export interface Settings {
  gateway: string;
  apiEndpoint: string;
  ipnsKeyName?: string;  // 用于文章列表的 IPNS 密钥名称
  ipnsId?: string;        // IPNS ID
  ipnsUrl?: string;       // IPNS 访问链接
}

const SETTINGS_KEY = 'settings';

const DEFAULT_SETTINGS: Settings = {
  gateway: 'https://ipfs.io/ipfs/',
  apiEndpoint: 'http://127.0.0.1:5001'
};

/**
 * 获取设置
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
}

/**
 * 保存设置
 */
export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
  return updated;
}
