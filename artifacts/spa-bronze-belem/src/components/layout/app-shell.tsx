import { type ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { useLocation } from 'wouter';

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col md:flex-row font-sans selection:bg-primary/20 selection:text-primary-dark">
      <Sidebar className="hidden md:flex w-[260px] lg:w-[280px] shrink-0 border-r border-border/40 relative z-20" />
      <MobileNav 
        isOpen={isMobileMenuOpen} 
        onOpenChange={setIsMobileMenuOpen} 
        className="flex md:hidden z-30 relative"
      />
      
      <div className="flex-1 flex flex-col min-w-0 bg-background h-[100dvh] relative z-10">
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 lg:p-10">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}