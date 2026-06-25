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
        <img src="/app-icon.svg" alt="主播通" className="h-11 w-11 mb-5" />

        <Link
          to="/chat"
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl transition-all',
            location.pathname === '/chat' || location.pathname === '/'
              ? 'bg-primary text-primary-foreground shadow-sm scale-105'
              : 'text-muted-foreground hover:bg-accent hover:scale-105'
          )}
        >
          <MessageSquare className="h-5 w-5" />
        </Link>

        <Link
          to="/activity-recommend"
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl transition-all mt-2',
            location.pathname === '/activity-recommend'
              ? 'bg-primary text-primary-foreground shadow-sm scale-105'
              : 'text-muted-foreground hover:bg-accent hover:scale-105'
          )}
          title="活动推荐"
        >
          <Sparkles className="h-5 w-5" />
        </Link>

        {/* 底部用户头像 + 退出 */}
        <div className="mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-sm font-semibold hover:from-primary/30 hover:to-accent/30 transition-all">
              {user?.name?.charAt(0) || '?'}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end">
              <div className="px-3 py-2 text-sm font-medium">{user?.name}</div>
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
