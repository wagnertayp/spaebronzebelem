import { type ReactNode } from 'react';
import { Navbar } from './navbar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex p-4 pb-4 md:p-4 md:pb-4 flex-col">
      <div className="flex-1 w-full bg-surface rounded-[22px] shadow-container border border-border overflow-hidden flex flex-col mx-auto max-w-[1600px]">
        <Navbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
