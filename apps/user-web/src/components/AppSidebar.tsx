import { MessageSquare, LogOut, Sparkles } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen w-full">
      {/* 侧边导航 */}
      <nav className="w-16 flex flex-col items-center py-4 border-r bg-muted/30">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground mb-4">
          <MessageSquare className="h-5 w-5" />
        </div>

        <Link
          to="/chat"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            location.pathname === '/chat' || location.pathname === '/'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <MessageSquare className="h-5 w-5" />
        </Link>

        <Link
          to="/activity-recommend"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            location.pathname === '/activity-recommend'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          title="活动推荐"
        >
          <Sparkles className="h-5 w-5" />
        </Link>

        {/* 底部用户头像 + 退出 */}
        <div className="mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
              {user?.name?.charAt(0) || '?'}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end">
              <div className="px-2 py-1.5 text-sm font-medium">{user?.name}</div>
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="flex-1 min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
