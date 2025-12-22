/**
 * IPFS 通信逻辑封装
 * 使用本地 IPFS Desktop 节点
 */

import { getSettings } from './storage';

export interface IpfsUploadResult {
  cid: string;
  url: string;
}

// 默认 IPFS API 地址
const DEFAULT_API = 'http://127.0.0.1:5001/api/v0';
const DEFAULT_GATEWAY = 'https://ipfs.io/ipfs/';

/**
 * 获取 IPFS API 地址
 */
async function getApiEndpoint(): Promise<string> {
  try {
    const settings = await getSettings();
    return settings.apiEndpoint ? `${settings.apiEndpoint}/api/v0` : DEFAULT_API;
  } catch {
    return DEFAULT_API;
  }
}

/**
 * 获取 IPFS 网关地址
 */
async function getGateway(): Promise<string> {
  try {
    const settings = await getSettings();
    return settings.gateway || DEFAULT_GATEWAY;
  } catch {
    return DEFAULT_GATEWAY;
  }
}

/**
 * 上传内容到 IPFS
 * @param content 文本内容
 * @param filename 文件名
 * @param mimeType MIME 类型（默认为 text/html）
 */
export async function uploadToIpfs(content: string, filename: string, mimeType: string = 'text/html'): Promise<IpfsUploadResult> {
  const formData = new FormData();
  const blob = new Blob([content], { type: mimeType });
  formData.append('file', blob, filename);

  const apiEndpoint = await getApiEndpoint();
  const gateway = await getGateway();

  try {
    const response = await fetch(`${apiEndpoint}/add?pin=true`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`IPFS API Error: ${response.status}`);
    }

    const text = await response.text();
    // IPFS 返回 NDJSON 格式，取最后一行
    const lines = text.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const data = JSON.parse(lastLine);
    const cid = data.Hash;

    return {
      cid: cid,
      url: `${gateway}${cid}`,
    };
  } catch (error: any) {
    console.error('Upload failed:', error);
    throw new Error(`上传失败: ${error.message}`);
  }
}

/**
 * 检查 IPFS 节点是否可用
 */
export async function checkIpfsNode(): Promise<boolean> {
  try {
    const apiEndpoint = await getApiEndpoint();
    const response = await fetch(`${apiEndpoint}/id`, {
      method: 'POST',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============ IPNS 相关 API ============

export interface IpnsKey {
  Name: string;
  Id: string;
}

/**
 * 获取所有 IPNS 密钥
 */
export async function listKeys(): Promise<IpnsKey[]> {
  const apiEndpoint = await getApiEndpoint();
  const response = await fetch(`${apiEndpoint}/key/list`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`获取密钥列表失败: ${response.status}`);
  }
  
  const data = await response.json();
  return data.Keys || [];
}

/**
 * 生成新的 IPNS 密钥
 * @param keyName 密钥名称
 */
export async function generateKey(keyName: string): Promise<IpnsKey> {
  const apiEndpoint = await getApiEndpoint();
  const response = await fetch(`${apiEndpoint}/key/gen?arg=${encodeURIComponent(keyName)}&type=ed25519`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`生成密钥失败: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * 发布 CID 到 IPNS
 * @param cid 要发布的 CID
 * @param keyName 使用的密钥名称（默认为 self）
 */
export async function publishToIpns(cid: string, keyName: string = 'self'): Promise<{ Name: string; Value: string }> {
  const apiEndpoint = await getApiEndpoint();
  const response = await fetch(`${apiEndpoint}/name/publish?arg=${cid}&key=${encodeURIComponent(keyName)}`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`发布 IPNS 失败: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * 获取 IPNS 访问链接
 * @param ipnsId IPNS ID
 */
export async function getIpnsUrl(ipnsId: string): Promise<string> {
  const gateway = await getGateway();
  // 将 /ipfs/ 替换为 /ipns/
  const ipnsGateway = gateway.replace('/ipfs/', '/ipns/');
  return `${ipnsGateway}${ipnsId}`;
}
