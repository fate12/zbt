import { useState } from 'react';
import { useAuth } from '@/lib/use-auth';
import { Button } from '@/components/ui/button';
import { MessageSquare, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [account_name, setAccountName] = useState('');
  const [account_password, setAccountPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(account_name, account_password);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4">
            <MessageSquare className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">主播通</h1>
          <p className="text-sm text-muted-foreground mt-1">AI 智能助手</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-background rounded-xl border p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">账号</label>
            <input
              type="text"
              value={account_name}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="请输入账号"
              className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">密码</label>
            <input
              type="password"
              value={account_password}
              onChange={(e) => setAccountPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            登录
          </Button>
        </form>
      </div>
    </div>
  );
}
