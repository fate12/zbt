import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/use-auth';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </AuthProvider>
  );
}
