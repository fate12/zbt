import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 统一的 Markdown 渲染组件：
 * - remark-gfm：表格/删除线/任务列表 + 裸 URL 自动链接（兜底）
 * - 链接统一在新标签页打开，避免覆盖当前应用
 * - 复用全局 .markdown-body 链接样式（text-primary underline）
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
