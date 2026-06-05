import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiFetch } from '@/lib/api';
import { Upload, FileText, Trash2, CheckCircle, Clock, AlertCircle, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Document {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  status: 'uploading' | 'parsing' | 'ready' | 'error';
  index_id: string;
  created_at: string;
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await apiFetch('/api/knowledge/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.data || []);
      }
    } catch (e) {
      console.error('加载文档失败', e);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const token = getToken();
        const res = await fetch('/api/knowledge/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setDocuments((prev) => [data.data, ...prev]);
        } else {
          console.error('上传失败', await res.text());
        }
      } catch (e) {
        console.error('上传失败', e);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (docId: string) => {
    try {
      const res = await apiFetch(`/api/knowledge/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch (e) {
      console.error('删除失败', e);
    }
  };

  function getToken(): string | null {
    return (
      (window as any).__SUPABASE_ACCESS_TOKEN__ ||
      document.cookie
        .split(';')
        .map((c) => c.trim().split('='))
        .find(([k]) => k === 'access_token')?.[1]
        ? decodeURIComponent(
            document.cookie
              .split(';')
              .map((c) => c.trim().split('='))
              .find(([k]) => k === 'access_token')?.[1] || ''
          )
        : null
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const statusIcon = (status: Document['status']) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'parsing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'uploading':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const statusText = (status: Document['status']) => {
    switch (status) {
      case 'ready': return '就绪';
      case 'parsing': return '解析中';
      case 'uploading': return '上传中';
      case 'error': return '异常';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">知识库管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          上传文档到知识库，AI助手将基于知识库内容回答问题
        </p>
      </div>

      {/* 上传区域 */}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
          dragOver ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md,.pptx,.xlsx"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">上传中...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">拖拽文件到此处或点击上传</span>
            <span className="text-xs text-muted-foreground">
              支持 PDF、DOCX、TXT、Markdown、PPTX、XLSX 格式
            </span>
          </div>
        )}
      </div>

      {/* 文档列表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">已上传文档 ({documents.length})</span>
        </div>
        {documents.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            暂无文档，请上传文件到知识库
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{doc.file_name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatSize(doc.file_size)}</span>
                      <span>·</span>
                      <span>{new Date(doc.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusIcon(doc.status)}
                    <span className="text-xs text-muted-foreground">{statusText(doc.status)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
