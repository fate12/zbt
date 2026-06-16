import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  FileText,
  Loader2,
  BookOpen,
  UserRound,
  Tags,
  History,
  Trash2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/use-auth';

interface SourceDoc {
  title: string;
  content: string;
  score: number;
}

interface ActivityHistoryItem {
  id: string;
  content: string;
  sources: SourceDoc[];
  created_at: string;
}

// 格式化时间为 MM-DD HH:mm
function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}

// 去除 markdown 标记，生成纯文本预览
function plainPreview(markdown: string, len = 40): string {
  const text = (markdown || '')
    .replace(/[#*`>_~\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > len ? text.slice(0, len) + '…' : text;
}

export default function ActivityRecommendPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [error, setError] = useState('');

  const [history, setHistory] = useState<ActivityHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载历史列表
  const loadHistory = useCallback(async (selectLatest = false) => {
    try {
      const res = await apiFetch('/api/activity-recommend/history?limit=50');
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          const list: ActivityHistoryItem[] = result.data || [];
          setHistory(list);
          if (selectLatest && list.length > 0) {
            setSelectedId(list[0].id);
          }
          return list;
        }
      }
    } catch {
      // ignore errors
    }
    return null;
  }, []);

  // 首次加载：拉取历史并选中最新一条
  useEffect(() => {
    (async () => {
      const list = await loadHistory(true);
      // 若没有历史，selectedId 保持 null，主区显示空态
      if (list && list.length === 0) {
        setSelectedId(null);
      }
      setHistoryLoading(false);
    })();
  }, [loadHistory]);

  // 当前展示的记录：生成中展示流式 state，否则展示选中历史
  const selectedItem = history.find((h) => h.id === selectedId) || null;
  const displayContent = loading ? content : (selectedItem?.content ?? content);
  const displaySources = loading ? sources : (selectedItem?.sources ?? sources);
  const hasResult = !loading && (!!displayContent || displaySources.length > 0);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayContent, displaySources]);

  const handleRecommend = async () => {
    setLoading(true);
    setContent('');
    setSources([]);
    setError('');
    setSelectedId(null); // 生成期间主区展示流式内容

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

      // 生成完成后刷新历史并选中最新一条（accumulatedContent 为可靠的本地变量）
      if (accumulatedContent) {
        await loadHistory(true);
      }
    } catch (e: any) {
      setError(e.message || '获取推荐失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = history;
    // 乐观删除
    setHistory(prev.filter((h) => h.id !== id));
    if (selectedId === id) {
      const next = prev.filter((h) => h.id !== id);
      setSelectedId(next.length > 0 ? next[0].id : null);
    }
    try {
      await apiFetch(`/api/activity-recommend/${id}`, { method: 'DELETE' });
    } catch {
      // 回滚
      setHistory(prev);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 左侧历史列表 */}
      <div
        className={cn(
          'flex flex-col border-r bg-muted/30 transition-all duration-200',
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="flex items-center gap-2 text-base font-semibold text-foreground">
            <History className="h-4 w-4" />
            历史推荐
          </span>
          <span className="text-xs text-muted-foreground">{history.length}</span>
        </div>
        <ScrollArea className="flex-1 rounded-xl">
          <div className="px-3 py-3 space-y-1.5">
            {historyLoading ? (
              <HistoryListSkeleton />
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group flex items-start gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-all',
                    selectedId === item.id
                      ? 'bg-primary/90 text-primary-foreground shadow-sm'
                      : 'hover:bg-accent/80'
                  )}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="line-clamp-2 text-sm font-medium break-words">
                      {plainPreview(item.content, 80) || '暂无内容'}
                    </div>
                    <div
                      className={cn(
                        'text-xs mt-1',
                        selectedId === item.id ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      )}
                    >
                      {formatTime(item.created_at)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100',
                      selectedId === item.id && 'text-primary-foreground hover:bg-primary-foreground/20'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
            {!historyLoading && history.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无历史推荐
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 右侧主区 */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* 顶部标题区 */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            <div>
              <h1 className="text-lg font-semibold">活动推荐</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                基于您的赛道和兴趣，为您匹配最合适的活动
              </p>
            </div>
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
            {user && <AnchorProfilePanel user={user} />}

            {historyLoading && <ActivityRecommendSkeleton />}

            {/* 空状态 */}
            {!historyLoading && !hasResult && !loading && !error && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Sparkles className="h-12 w-12 mb-4 text-primary/50" />
                <h2 className="text-lg font-medium mb-2">智能活动推荐</h2>
                <p className="text-sm">点击上方按钮，获取为您定制的活动推荐</p>
              </div>
            )}

            {/* 错误提示 */}
            {!historyLoading && error && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* 匹配的知识库文档 */}
            {!historyLoading && displaySources.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BookOpen className="h-4 w-4" />
                  <span>匹配的知识库文档（{displaySources.length}条）</span>
                </div>
                <div className="grid gap-3">
                  {displaySources.map((src, idx) => (
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
            {!historyLoading && (displayContent || loading) && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  <span>AI 活动推荐</span>
                </div>
                <div className="rounded-xl border p-4">
                  {displayContent ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{displayContent}</ReactMarkdown>
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
    </div>
  );
}

function AnchorProfilePanel({
  user,
}: {
  user: {
    emp_id: string;
    name: string;
    track_description?: string;
    tags?: string[];
    interests?: string[];
  };
}) {
  const tags = user.tags || [];
  const interests = user.interests || [];

  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">主播账号</div>
              <div className="mt-0.5 truncate text-base font-semibold">{user.name || '未命名主播'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">主播ID</div>
              <div className="mt-0.5 truncate text-base font-semibold">{user.emp_id}</div>
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground">赛道介绍</div>
            <p className="mt-1 text-sm leading-relaxed">
              {user.track_description || '暂未设置赛道介绍，请在后台管理系统完善主播资料。'}
            </p>
          </div>

          {(tags.length > 0 || interests.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={`tag-${tag}`} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  <Tags className="h-3 w-3" />
                  {tag}
                </span>
              ))}
              {interests.map((interest) => (
                <span key={`interest-${interest}`} className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function HistoryListSkeleton() {
  return (
    <div className="space-y-1.5 animate-in fade-in-0 duration-200">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <div className="h-4 w-4 shrink-0 rounded bg-muted-foreground/10" />
          <div className="h-4 flex-1 rounded bg-muted-foreground/10" />
        </div>
      ))}
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
