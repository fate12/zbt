import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, FileText, Loader2, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { apiFetch } from '@/lib/api';

interface SourceDoc {
  title: string;
  content: string;
  score: number;
}

export default function ActivityRecommendPage() {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 从服务器加载最近的推荐
  useEffect(() => {
    const loadLastRecommend = async () => {
      try {
        const res = await apiFetch('/api/activity-recommend/last');
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data) {
            setContent(result.data.content || '');
            setSources(result.data.sources || []);
          }
        }
      } catch {
        // ignore errors
      } finally {
        setInitialLoading(false);
      }
    };
    loadLastRecommend();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [content, sources]);

  const handleRecommend = async () => {
    setLoading(true);
    setContent('');
    setSources([]);
    setError('');

    try {
      const res = await apiFetch('/api/activity-recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`请求失败: ${res.status}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content') {
                  accumulatedContent += parsed.content;
                  setContent(accumulatedContent);
                } else if (parsed.type === 'sources') {
                  setSources(parsed.sources || []);
                } else if (parsed.type === 'error') {
                  setError(parsed.content || '推荐失败');
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      }
    } catch (e: any) {
      setError(e.message || '获取推荐失败');
    } finally {
      setLoading(false);
    }
  };

  const hasResult = content || sources.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* 顶部标题区 */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">活动推荐</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            基于您的赛道和兴趣，为您匹配最合适的活动
          </p>
        </div>
        <Button
          onClick={handleRecommend}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? '正在获取推荐...' : '获取推荐'}
        </Button>
      </div>

      {/* 内容区 */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {initialLoading && <ActivityRecommendSkeleton />}

          {/* 空状态 */}
          {!initialLoading && !hasResult && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Sparkles className="h-12 w-12 mb-4 text-primary/50" />
              <h2 className="text-lg font-medium mb-2">智能活动推荐</h2>
              <p className="text-sm">点击上方按钮，获取为您定制的活动推荐</p>
            </div>
          )}

          {/* 错误提示 */}
          {!initialLoading && error && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* 匹配的知识库文档 */}
          {!initialLoading && sources.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-4 w-4" />
                <span>匹配的知识库文档（{sources.length}条）</span>
              </div>
              <div className="grid gap-3">
                {sources.map((src, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium truncate">
                            {src.title || `文档 ${idx + 1}`}
                          </span>
                          {src.score > 0 && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              匹配度 {(src.score * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {src.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI推荐内容 */}
          {!initialLoading && (content || loading) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                <span>AI 活动推荐</span>
              </div>
              <div className="rounded-xl border p-4">
                {content ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>正在生成推荐...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>
    </div>
  );
}

function ActivityRecommendSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-200">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted-foreground/10" />
          <div className="h-4 w-36 rounded bg-muted-foreground/10" />
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={idx} className="rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-4 w-4 shrink-0 rounded bg-muted-foreground/10" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-muted-foreground/10" />
                  <div className="h-3 w-full rounded bg-muted-foreground/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted-foreground/10" />
          <div className="h-4 w-28 rounded bg-muted-foreground/10" />
        </div>
        <div className="space-y-2 rounded-xl border p-4">
          <div className="h-4 w-5/6 rounded bg-muted-foreground/10" />
          <div className="h-4 w-full rounded bg-muted-foreground/10" />
          <div className="h-4 w-11/12 rounded bg-muted-foreground/10" />
          <div className="h-4 w-2/3 rounded bg-muted-foreground/10" />
        </div>
      </div>
    </div>
  );
}
