/**
 * 发布列表存储服务
 */

// 文章发布状态
export type PublishStatus = 'draft' | 'publishing' | 'published' | 'failed';

export interface PublishRecord {
	id: string;
	title: string;
	content: string;
	// 发布状态
	status: PublishStatus;
	// IPFS 发布信息（发布后才有）
	cid?: string;
	url?: string;
	publishedAt?: number;
	// 时间戳
	createdAt: number;
	updatedAt: number;
	// IPNS 永久链接相关
	ipnsKeyName?: string;
	ipnsId?: string;
	ipnsUrl?: string;
	// 错误信息
	errorMessage?: string;
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
	return records.find((r) => r.id === id) || null;
}

/**
 * 添加记录（本地保存，未发布状态）
 */
export async function addRecord(data: {
	title: string;
	content: string;
	cid?: string;
	url?: string;
	status?: PublishStatus;
}): Promise<PublishRecord> {
	const records = await getRecords();
	const now = Date.now();

	const newRecord: PublishRecord = {
		id: generateId(),
		title: data.title,
		content: data.content,
		status: data.status || 'draft',
		cid: data.cid,
		url: data.url,
		createdAt: now,
		updatedAt: now,
		publishedAt: data.cid ? now : undefined,
	};

	records.unshift(newRecord); // 新记录放在最前面
	await chrome.storage.local.set({ [STORAGE_KEY]: records });

	return newRecord;
}

/**
 * 更新记录
 */
export async function updateRecord(
	id: string,
	data: {
		title?: string;
		content?: string;
		status?: PublishStatus;
		cid?: string;
		url?: string;
		publishedAt?: number;
		ipnsKeyName?: string;
		ipnsId?: string;
		ipnsUrl?: string;
		errorMessage?: string;
	},
): Promise<PublishRecord | null> {
	const records = await getRecords();
	const index = records.findIndex((r) => r.id === id);

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
	const index = records.findIndex((r) => r.id === id);

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
	ipnsKeyName?: string; // 用于文章列表的 IPNS 密钥名称
	ipnsId?: string; // IPNS ID
	ipnsUrl?: string; // IPNS 访问链接
}

const SETTINGS_KEY = 'settings';

const DEFAULT_SETTINGS: Settings = {
	gateway: 'https://ipfs.io/ipfs/',
	apiEndpoint: 'http://127.0.0.1:5001',
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

// ============ 话题列表存储 ============

export interface TopicList {
	id: string;
	name: string;
	description?: string;
	author?: string;
	// 包含的文章 ID 列表
	articleIds: string[];
	// IPNS 发布信息
	ipnsKeyName?: string;
	ipnsId?: string;
	ipnsUrl?: string;
	// 最后发布时间
	lastPublishedAt?: number;
	// 时间戳
	createdAt: number;
	updatedAt: number;
}

const TOPICS_KEY = 'topicLists';

/**
 * 获取所有话题列表
 */
export async function getTopics(): Promise<TopicList[]> {
	const result = await chrome.storage.local.get(TOPICS_KEY);
	return result[TOPICS_KEY] || [];
}

/**
 * 获取单个话题
 */
export async function getTopic(id: string): Promise<TopicList | null> {
	const topics = await getTopics();
	return topics.find((t) => t.id === id) || null;
}

/**
 * 创建话题列表
 */
export async function createTopic(data: {
	name: string;
	description?: string;
	author?: string;
}): Promise<TopicList> {
	const topics = await getTopics();
	const now = Date.now();

	const newTopic: TopicList = {
		id: generateId(),
		name: data.name,
		description: data.description,
		author: data.author,
		articleIds: [],
		createdAt: now,
		updatedAt: now,
	};

	topics.unshift(newTopic);
	await chrome.storage.local.set({ [TOPICS_KEY]: topics });

	return newTopic;
}

/**
 * 更新话题列表
 */
export async function updateTopic(
	id: string,
	data: {
		name?: string;
		description?: string;
		author?: string;
		articleIds?: string[];
		ipnsKeyName?: string;
		ipnsId?: string;
		ipnsUrl?: string;
		lastPublishedAt?: number;
	},
): Promise<TopicList | null> {
	const topics = await getTopics();
	const index = topics.findIndex((t) => t.id === id);

	if (index === -1) return null;

	topics[index] = {
		...topics[index],
		...data,
		updatedAt: Date.now(),
	};

	await chrome.storage.local.set({ [TOPICS_KEY]: topics });
	return topics[index];
}

/**
 * 删除话题列表
 */
export async function deleteTopic(id: string): Promise<boolean> {
	const topics = await getTopics();
	const index = topics.findIndex((t) => t.id === id);

	if (index === -1) return false;

	topics.splice(index, 1);
	await chrome.storage.local.set({ [TOPICS_KEY]: topics });

	return true;
}

/**
 * 向话题添加文章
 */
export async function addArticleToTopic(topicId: string, articleId: string): Promise<boolean> {
	const topic = await getTopic(topicId);
	if (!topic) return false;

	if (!topic.articleIds.includes(articleId)) {
		topic.articleIds.push(articleId);
		await updateTopic(topicId, { articleIds: topic.articleIds });
	}

	return true;
}

/**
 * 从话题移除文章
 */
export async function removeArticleFromTopic(topicId: string, articleId: string): Promise<boolean> {
	const topic = await getTopic(topicId);
	if (!topic) return false;

	const index = topic.articleIds.indexOf(articleId);
	if (index > -1) {
		topic.articleIds.splice(index, 1);
		await updateTopic(topicId, { articleIds: topic.articleIds });
	}

	return true;
}

/**
 * 获取文章所属的所有话题
 */
export async function getArticleTopics(articleId: string): Promise<TopicList[]> {
	const topics = await getTopics();
	return topics.filter((t) => t.articleIds.includes(articleId));
}
