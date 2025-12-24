import { uploadToIpfs, checkIpfsNode, listKeys, generateKey, publishToIpns, getIpnsUrl } from '../utils/ipfs';
import {
	addRecord,
	getRecords,
	getRecord,
	updateRecord,
	deleteRecord,
	getSettings,
	saveSettings,
	getTopics,
	getTopic,
	createTopic,
	updateTopic,
	deleteTopic,
	addArticleToTopic,
	removeArticleFromTopic,
} from '../utils/storage';
import { generateHtmlPage, generateListPage, generateTopicListPage } from '../utils/template';

// 定义消息类型接口
interface SaveMessage {
	action: 'save';
	title: string;
	content: string;
	id?: string; // 编辑时传入
}

interface PublishMessage {
	action: 'publishArticle';
	id: string;
}

interface PublishAllMessage {
	action: 'publishAllArticles';
}

interface CheckNodeMessage {
	action: 'checkNode';
}

interface RecordMessage {
	action: 'getRecords' | 'getRecord' | 'deleteRecord';
	id?: string;
}

type Message =
	| SaveMessage
	| PublishMessage
	| PublishAllMessage
	| CheckNodeMessage
	| RecordMessage
	| { action: string; [key: string]: any };

export default defineBackground(() => {
	console.log('IPFS Publisher Background Service Started!', { id: browser.runtime.id });
});

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// ============ 保存文章（仅本地） ============
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
	if (request.action === 'save') {
		const { title, content, id } = request as SaveMessage;

		(async () => {
			try {
				let record;
				if (id) {
					// 更新现有记录
					record = await updateRecord(id, {
						title,
						content,
						// 如果内容有变化，重置发布状态为 draft（需要重新发布）
						status: 'draft',
					});
				} else {
					// 新建记录
					record = await addRecord({
						title,
						content,
						status: 'draft',
					});
				}
				console.log('[IPFS Publisher] 文章已保存:', record?.id);
				sendResponse({ success: true, data: record });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();

		return true;
	}
});

// ============ 发布单篇文章到 IPFS + 自动更新 IPNS 永久链接 ============
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
	if (request.action === 'publishArticle') {
		const { id } = request as PublishMessage;

		(async () => {
			try {
				// 获取文章记录
				const record = await getRecord(id);
				if (!record) {
					throw new Error('文章不存在');
				}

				// 更新状态为发布中
				await updateRecord(id, { status: 'publishing' });

				// 生成带样式的 HTML 页面
				const htmlContent = generateHtmlPage(record.title, record.content, record.createdAt);
				const filename = `${record.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.html`;

				console.log('[IPFS Publisher] 发布文章:', record.title);

				// 上传到 IPFS
				const result = await uploadToIpfs(htmlContent, filename, 'text/html');
				console.log('[IPFS Publisher] IPFS 上传成功, CID:', result.cid);

				// 使用固定的密钥名（基于文章ID）
				const keyName = record.ipnsKeyName || `article-${record.id.substring(0, 8)}`;
				// 保留之前的 IPNS 信息作为备用
				let ipnsUrl = record.ipnsUrl || '';
				let ipnsId = record.ipnsId || '';
				
				try {
					// 检查密钥是否存在
					const existingKeys = await listKeys();
					const existingKey = existingKeys.find(k => k.Name === keyName);
					
					if (!existingKey) {
						const newKey = await generateKey(keyName);
						console.log('[IPFS Publisher] 已创建文章密钥:', keyName, newKey.Id);
					}
					
					// 发布新 CID 到 IPNS（更新永久链接指向最新内容）
					console.log('[IPFS Publisher] 正在更新 IPNS 指向新 CID:', result.cid);
					const ipnsResult = await publishToIpns(result.cid, keyName);
					ipnsId = ipnsResult.Name;
					ipnsUrl = await getIpnsUrl(ipnsResult.Name);
					console.log('[IPFS Publisher] IPNS 更新成功:', ipnsUrl, '指向:', ipnsResult.Value);
				} catch (ipnsError: any) {
					// IPNS 失败不影响 IPFS 发布结果，保留之前的 IPNS 信息
					console.warn('[IPFS Publisher] IPNS 更新失败，但 IPFS 已成功:', ipnsError.message);
				}

				// 更新记录
				const updatedRecord = await updateRecord(id, {
					status: 'published',
					cid: result.cid,
					url: result.url,
					publishedAt: Date.now(),
					ipnsKeyName: keyName,
					ipnsId: ipnsId || undefined,
					ipnsUrl: ipnsUrl || undefined,
					errorMessage: undefined,
				});

				console.log('[IPFS Publisher] 文章发布完成');
				sendResponse({ success: true, data: { ...result, ipnsUrl, record: updatedRecord } });
			} catch (error: any) {
				// 更新状态为失败
				await updateRecord(id, {
					status: 'failed',
					errorMessage: error.message,
				});
				console.error('[IPFS Publisher] 文章发布失败:', error);
				sendResponse({ success: false, error: error.message });
			}
		})();

		return true;
	}
});

// ============ 批量发布所有草稿文章 + 自动更新 IPNS ============
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
	if (request.action === 'publishAllArticles') {
		(async () => {
			try {
				const records = await getRecords();
				// 筛选出需要发布的文章（草稿或失败状态）
				const toPublish = records.filter(r => r.status === 'draft' || r.status === 'failed');
				
				if (toPublish.length === 0) {
					sendResponse({ success: true, data: { published: 0, failed: 0, results: [] } });
					return;
				}

				const results: { id: string; success: boolean; cid?: string; ipnsUrl?: string; error?: string }[] = [];
				let published = 0;
				let failed = 0;

				for (const record of toPublish) {
					try {
						// 更新状态为发布中
						await updateRecord(record.id, { status: 'publishing' });

						// 生成 HTML 并上传
						const htmlContent = generateHtmlPage(record.title, record.content, record.createdAt);
						const filename = `${record.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.html`;
						const result = await uploadToIpfs(htmlContent, filename, 'text/html');

						// 使用固定的密钥名（基于文章ID）
						const keyName = record.ipnsKeyName || `article-${record.id.substring(0, 8)}`;
						let ipnsUrl = record.ipnsUrl || '';
						let ipnsId = record.ipnsId || '';
						
						try {
							const existingKeys = await listKeys();
							if (!existingKeys.some(k => k.Name === keyName)) {
								await generateKey(keyName);
							}
							// 发布新 CID 到 IPNS（更新永久链接指向最新内容）
							const ipnsResult = await publishToIpns(result.cid, keyName);
							ipnsId = ipnsResult.Name;
							ipnsUrl = await getIpnsUrl(ipnsResult.Name);
						} catch (ipnsError: any) {
							console.warn('[IPFS Publisher] IPNS 更新失败:', ipnsError.message);
						}

						// 更新记录
						await updateRecord(record.id, {
							status: 'published',
							cid: result.cid,
							url: result.url,
							publishedAt: Date.now(),
							ipnsKeyName: keyName,
							ipnsId: ipnsId || undefined,
							ipnsUrl: ipnsUrl || undefined,
							errorMessage: undefined,
						});

						results.push({ id: record.id, success: true, cid: result.cid, ipnsUrl });
						published++;
						console.log('[IPFS Publisher] 批量发布 - 成功:', record.title);
					} catch (error: any) {
						await updateRecord(record.id, {
							status: 'failed',
							errorMessage: error.message,
						});
						results.push({ id: record.id, success: false, error: error.message });
						failed++;
						console.error('[IPFS Publisher] 批量发布 - 失败:', record.title, error);
					}
				}

				sendResponse({ success: true, data: { published, failed, results } });
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
		const extensionURL = browserAPI.runtime.getURL('/options.html');
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
			body: data || undefined,
		})
			.then(async (response) => {
				const text = await response.text();
				sendResponse({
					status: response.status,
					statusText: response.statusText,
					data: text,
				});
			})
			.catch((error) => {
				sendResponse({
					error: error.message,
				});
			});

		return true;
	}
});

// 获取设置
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
	if (request.action === 'getSettings') {
		(async () => {
			try {
				const settings = await getSettings();
				sendResponse({ success: true, data: settings });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// 保存设置
browserAPI.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
	if (request.action === 'saveSettings') {
		(async () => {
			try {
				const settings = await saveSettings(request.data);
				sendResponse({ success: true, data: settings });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// ============ IPNS 相关 ============

// 获取 IPNS 密钥列表
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
	if (request.action === 'listKeys') {
		(async () => {
			try {
				const keys = await listKeys();
				sendResponse({ success: true, data: keys });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// 生成 IPNS 密钥
browserAPI.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
	if (request.action === 'generateKey') {
		(async () => {
			try {
				const key = await generateKey(request.keyName);
				sendResponse({ success: true, data: key });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// 发布文章列表页到 IPNS
browserAPI.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
	if (request.action === 'publishListToIpns') {
		(async () => {
			try {
				const { keyName } = request;
				const settings = await getSettings();

				// 获取所有已发布的文章记录
				const allRecords = await getRecords();
				const publishedRecords = allRecords.filter(r => r.status === 'published' && r.cid);

				// 转换为 ListPageRecord 格式
				const listRecords = publishedRecords.map(r => ({
					id: r.id,
					title: r.title,
					content: r.content,
					cid: r.cid!,
					createdAt: r.createdAt,
				}));

				// 生成列表页 HTML
				const gateway = settings.gateway || 'https://ipfs.io/ipfs/';
				const listHtml = generateListPage(listRecords, gateway);

				// 上传到 IPFS
				const uploadResult = await uploadToIpfs(listHtml, 'article-list.html', 'text/html');
				console.log('[IPFS Publisher] 列表页已上传, CID:', uploadResult.cid);

				// 发布到 IPNS
				const ipnsResult = await publishToIpns(uploadResult.cid, keyName);
				console.log('[IPFS Publisher] IPNS 发布成功:', ipnsResult);

				// 获取 IPNS 访问链接
				const ipnsUrl = await getIpnsUrl(ipnsResult.Name);

				// 保存 IPNS 信息到设置
				await saveSettings({
					ipnsKeyName: keyName,
					ipnsId: ipnsResult.Name,
					ipnsUrl: ipnsUrl,
				});

				sendResponse({
					success: true,
					data: {
						cid: uploadResult.cid,
						ipnsId: ipnsResult.Name,
						ipnsUrl: ipnsUrl,
					},
				});
			} catch (error: any) {
				console.error('[IPFS Publisher] IPNS 发布失败:', error);
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// ============ 话题列表管理 ============

// 获取所有话题列表
browserAPI.runtime.onMessage.addListener((request: Message, sender, sendResponse) => {
	if (request.action === 'getTopics') {
		(async () => {
			try {
				const topics = await getTopics();
				sendResponse({ success: true, data: topics });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// 获取单个话题
browserAPI.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
	if (request.action === 'getTopic') {
		(async () => {
			try {
				const topic = await getTopic(request.id);
				sendResponse({ success: true, data: topic });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// 创建话题
browserAPI.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
	if (request.action === 'createTopic') {
		(async () => {
			try {
				const topic = await createTopic(request.data);
				console.log('[IPFS Publisher] 话题已创建:', topic.name);
				sendResponse({ success: true, data: topic });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// 更新话题
browserAPI.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
	if (request.action === 'updateTopic') {
		(async () => {
			try {
				const topic = await updateTopic(request.id, request.data);
				console.log('[IPFS Publisher] 话题已更新:', topic?.name);
				sendResponse({ success: true, data: topic });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// 删除话题
browserAPI.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
	if (request.action === 'deleteTopic') {
		(async () => {
			try {
				await deleteTopic(request.id);
				console.log('[IPFS Publisher] 话题已删除:', request.id);
				sendResponse({ success: true });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// 向话题添加文章
browserAPI.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
	if (request.action === 'addArticleToTopic') {
		(async () => {
			try {
				await addArticleToTopic(request.topicId, request.articleId);
				sendResponse({ success: true });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// 从话题移除文章
browserAPI.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
	if (request.action === 'removeArticleFromTopic') {
		(async () => {
			try {
				await removeArticleFromTopic(request.topicId, request.articleId);
				sendResponse({ success: true });
			} catch (error: any) {
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});

// 发布话题列表到 IPNS
browserAPI.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
	if (request.action === 'publishTopicToIpns') {
		(async () => {
			try {
				const { topicId } = request;
				const topic = await getTopic(topicId);
				if (!topic) {
					throw new Error('话题不存在');
				}

				const settings = await getSettings();
				const gateway = settings.gateway || 'https://ipfs.io/ipfs/';

				// 获取话题中的文章
				const allRecords = await getRecords();
				const topicRecords = allRecords.filter(
					r => topic.articleIds.includes(r.id) && r.status === 'published' && r.cid
				);

				// 转换为列表页格式
				const listRecords = topicRecords.map(r => ({
					id: r.id,
					title: r.title,
					content: r.content,
					cid: r.cid!,
					createdAt: r.createdAt,
				}));

				// 生成话题列表页 HTML
				const listHtml = generateTopicListPage(
					listRecords,
					gateway,
					topic.name,
					topic.description,
					topic.author
				);

				// 上传到 IPFS
				const uploadResult = await uploadToIpfs(listHtml, `topic-${topic.id}.html`, 'text/html');
				console.log('[IPFS Publisher] 话题列表页已上传, CID:', uploadResult.cid);

				// 确定使用的密钥名
				const keyName = topic.ipnsKeyName || `topic-${topic.id.substring(0, 8)}`;

				// 检查密钥是否存在，不存在则创建
				const existingKeys = await listKeys();
				if (!existingKeys.some(k => k.Name === keyName)) {
					await generateKey(keyName);
					console.log('[IPFS Publisher] 已创建话题密钥:', keyName);
				}

				// 发布到 IPNS
				const ipnsResult = await publishToIpns(uploadResult.cid, keyName);
				const ipnsUrl = await getIpnsUrl(ipnsResult.Name);
				console.log('[IPFS Publisher] 话题 IPNS 发布成功:', ipnsUrl);

				// 更新话题的 IPNS 信息
				await updateTopic(topicId, {
					ipnsKeyName: keyName,
					ipnsId: ipnsResult.Name,
					ipnsUrl: ipnsUrl,
					lastPublishedAt: Date.now(),
				});

				sendResponse({
					success: true,
					data: {
						cid: uploadResult.cid,
						ipnsId: ipnsResult.Name,
						ipnsUrl: ipnsUrl,
					},
				});
			} catch (error: any) {
				console.error('[IPFS Publisher] 话题 IPNS 发布失败:', error);
				sendResponse({ success: false, error: error.message });
			}
		})();
		return true;
	}
});


