import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Send,
  Bot,
  User,
  Loader2,
  BookOpen,
  FileText,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { authFetch } from '@/lib/use-auth';
import { resolveApiUrl } from '@/lib/api';

function getToken(): string | null {
  return localStorage.getItem('zhibotong_token');
}

interface Session {
  id: string;
  title: string;
  created_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; content: string; score: number }[];
  created_at: string;
}

export function ChatLayout() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await authFetch('/api/chat/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.data || []);
      }
    } catch (e) {
      console.error('加载会话失败', e);
    }
  }, []);

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await authFetch(`/api/chat/sessions/${sessionId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.data || []);
      }
    } catch (e) {
      console.error('加载消息失败', e);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (activeSessionId) loadMessages(activeSessionId);
    else setMessages([]);
  }, [activeSessionId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewSession = async () => {
    try {
      const res = await authFetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新对话' }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions((prev) => [data.data, ...prev]);
        setActiveSessionId(data.data.id);
      }
    } catch (e) {
      console.error('创建会话失败', e);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const res = await authFetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (e) {
      console.error('删除会话失败', e);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    let sessionId = activeSessionId;

    if (!sessionId) {
      try {
        const res = await authFetch('/api/chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.slice(0, 20) }),
        });
        if (res.ok) {
          const data = await res.json();
          setSessions((prev) => [data.data, ...prev]);
          sessionId = data.data.id;
          setActiveSessionId(sessionId);
        }
      } catch (e) {
        console.error('创建会话失败', e);
        return;
      }
    }

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    if (messages.length === 0) {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: text.slice(0, 20) } : s))
      );
    }

    try {
      const token = getToken();
      const apiUrl = resolveApiUrl(`/api/chat/sessions/${sessionId}/messages`);
      console.log('[AI助手] API地址:', apiUrl);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) throw new Error(`请求失败: ${res.status}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantId = `msg-${Date.now()}`;
      let sources: Message['sources'] = [];

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', created_at: new Date().toISOString() },
      ]);

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
                  assistantContent += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: assistantContent } : m
                    )
                  );
                } else if (parsed.type === 'sources') {
                  sources = parsed.sources;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, sources } : m
                    )
                  );
                }
              } catch {
                assistantContent += data;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: assistantContent } : m
                  )
                );
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('发送消息失败', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: '抱歉，发生了错误，请稍后重试。',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* 左侧会话列表 */}
      <div
        className={cn(
          'flex flex-col border-r bg-muted/30 transition-all duration-200',
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        )}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-semibold">对话历史</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewSession}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'group flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors',
                  activeSessionId === session.id && 'bg-accent text-accent-foreground'
                )}
                onClick={() => setActiveSessionId(session.id)}
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{session.title}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无对话，点击 + 开始
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 右侧聊天区域 */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-2 border-b px-4 h-12">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
          <span className="text-sm font-medium">
            {activeSession?.title || 'AI助手'}
          </span>
        </div>

        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.length === 0 && !activeSessionId && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Bot className="h-12 w-12 mb-4 text-primary/50" />
                <h2 className="text-lg font-medium mb-2">直播通 AI 助手</h2>
                <p className="text-sm">智能问答助手，为您解答直播相关问题</p>
                <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-md">
                  {['直播流程规范是什么？', '主播话术有哪些技巧？', '直播选品标准是什么？', '如何提高直播间转化率？'].map(
                    (q) => (
                      <button
                        key={q}
                        className="text-left text-sm rounded-lg border p-3 hover:bg-accent transition-colors"
                        onClick={() => {
                          setInput(q);
                          inputRef.current?.focus();
                        }}
                      >
                        {q}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback
                    className={cn(
                      msg.role === 'assistant'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary'
                    )}
                  >
                    {msg.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'flex flex-col gap-1 max-w-[80%]',
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-xl px-4 py-3 text-sm',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      msg.content ? (
                        <div className="markdown-body">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 mb-1">
                        <BookOpen className="h-3 w-3" />
                        <span>引用来源</span>
                      </div>
                      {msg.sources.map((src, idx) => (
                        <div key={idx} className="flex items-center gap-1 ml-4">
                          <FileText className="h-3 w-3" />
                          <span className="truncate">{src.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-xl px-4 py-3 bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 rounded-xl border bg-background p-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息，按 Enter 发送..."
                rows={1}
                className="flex-1 resize-none border-0 bg-transparent text-sm focus:outline-none focus:ring-0 placeholder:text-muted-foreground min-h-[36px] max-h-[120px] py-2 px-2"
                style={{ height: 'auto', minHeight: '36px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || loading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              AI 助手回答仅供参考
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
