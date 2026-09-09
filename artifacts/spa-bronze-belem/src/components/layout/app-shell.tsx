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
      <Sidebar className="hidden md:flex w-[280px] shrink-0 border-r border-border relative z-20 shadow-sm" />
      <MobileNav 
        isOpen={isMobileMenuOpen} 
        onOpenChange={setIsMobileMenuOpen} 
        className="flex md:hidden z-30 relative"
      />
      
      <div className="flex-1 flex flex-col min-w-0 bg-background relative z-10 h-[100dvh]">
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-7 md:px-9 md:py-9 lg:px-12 lg:py-10">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}