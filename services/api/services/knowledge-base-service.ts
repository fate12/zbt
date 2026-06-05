import { ENV } from '../_core/env.js';

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com';

export interface RetrieveParams {
  indexId: string;
  query: string;
  topK?: number;
  rerank?: boolean;
}

export interface RetrieveDocument {
  id: string;
  title: string;
  content: string;
  score: number;
  documentId?: string;
  chunkId?: string;
}

export interface RetrieveResult {
  documents: RetrieveDocument[];
  requestId: string;
}

export interface KnowledgeBaseIndex {
  indexId: string;
  indexName: string;
  status: string;
}

async function dashscopeFetch(path: string, body: Record<string, unknown>) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${ENV.dashscopeApiKey}`,
    'Content-Type': 'application/json',
  };

  // 只有配置了工作空间ID才添加该头部
  if (ENV.bailianWorkspaceId) {
    headers['X-DashScope-Workspace'] = ENV.bailianWorkspaceId;
  }

  const res = await fetch(`${DASHSCOPE_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DashScope API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function retrieve(params: RetrieveParams): Promise<RetrieveResult> {
  const data = await dashscopeFetch('/api/v1/apps/index/retrieval', {
    index_id: params.indexId,
    query: params.query,
    top_k: params.topK ?? 5,
    rerank: params.rerank ?? true,
  });

  const documents: RetrieveDocument[] = (data.output?.results ?? []).map((r: any) => ({
    id: r.id ?? r.chunk_id ?? '',
    title: r.title ?? r.document_title ?? '',
    content: r.content ?? r.text ?? '',
    score: r.score ?? 0,
    documentId: r.document_id,
    chunkId: r.chunk_id,
  }));

  return {
    documents,
    requestId: data.request_id ?? '',
  };
}

export async function retrieveAsContext(params: RetrieveParams): Promise<string> {
  const result = await retrieve(params);
  if (result.documents.length === 0) {
    return '';
  }
  return result.documents
    .map((doc, idx) => `[${idx + 1}] ${doc.title}\n${doc.content}`)
    .join('\n\n---\n\n');
}

export async function listIndices(): Promise<KnowledgeBaseIndex[]> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${ENV.dashscopeApiKey}`,
  };

  // 只有配置了工作空间ID才添加该头部
  if (ENV.bailianWorkspaceId) {
    headers['X-DashScope-Workspace'] = ENV.bailianWorkspaceId;
  }

  const res = await fetch(`${DASHSCOPE_BASE}/api/v1/apps/indexes`, {
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DashScope list indices error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return (data.output?.indexes ?? []).map((idx: any) => ({
    indexId: idx.index_id,
    indexName: idx.index_name,
    status: idx.status,
  }));
}
