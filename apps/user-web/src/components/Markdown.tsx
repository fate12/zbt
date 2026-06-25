import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 统一的 Markdown 渲染组件：
 * - remark-gfm：表格/删除线/任务列表 + 裸 URL 自动链接（兜底）
 * - 链接统一在新标签页打开，避免覆盖当前应用
 * - 复用全局 .markdown-body 链接样式（text-primary underline）
 * - 「报名条件」行渲染为浅色（次要信息），整体文字左对齐
 */

/** 递归提取 ReactNode 中的纯文本，用于按内容给列表项加样式 */
function nodeText(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(nodeText).join('');
  if (isValidElement(children)) return nodeText((children.props as { children?: ReactNode }).children);
  return '';
}

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body text-left">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
          li: ({ node, children, ...props }) => {
            // 「报名条件」行：标签（含冒号）保持正常色（与「报名链接」标签一致），
            // 仅内容部分用浅灰弱化
            const text = nodeText(children).trim();
            const m = text.match(/^(报名条件)([：:])([\s\S]*)$/);
            if (m) {
              return (
                <li className="text-muted-foreground" {...props}>
                  <span className="text-foreground">{m[1]}{m[2]}</span>
                  {m[3]}
                </li>
              );
            }
            return <li {...props}>{children}</li>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
