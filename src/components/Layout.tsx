import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Home, ClipboardList, Target, CheckCircle2, LineChart, Settings, Wallet, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

export function Layout() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Outlet />;
  }

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Check-in', path: '/check-in', icon: ClipboardList },
    { name: 'Missions', path: '/missions', icon: Target },
    { name: 'Habits', path: '/habits', icon: CheckCircle2 },
    { name: 'Health', path: '/health', icon: Activity },
    { name: 'Money', path: '/money', icon: Wallet },
    { name: 'Insights', path: '/analytics', icon: LineChart },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-bg-dark text-white flex flex-col md:flex-row font-sans">
      {/* Sidebar / Bottom Nav */}
      <nav className="fixed bottom-0 w-full md:w-64 md:relative md:h-screen bg-bg-dark border-t md:border-t-0 md:border-r border-border-dark z-50">
        <div className="flex flex-col h-full">
          <div className="hidden md:block p-6 mb-4">
            <h1 className="text-2xl font-bold text-neon-green tracking-tight">Meating v1.1</h1>
            <p className="text-xs text-zinc-500 mt-1">Pilot your Meat Suit</p>
          </div>

          <div className="flex md:flex-col flex-1 overflow-y-auto px-2 md:px-4 gap-2 justify-around md:justify-start py-2 md:py-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col md:flex-row items-center gap-1 md:gap-4 p-2 md:px-4 md:py-3 rounded-full transition-colors",
                    isActive 
                      ? "bg-[#1a2e1a] text-neon-green" 
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  )}
                >
                  <Icon className="w-5 h-5 md:w-5 md:h-5" />
                  <span className="text-[10px] md:text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto bg-bg-dark">
        <div className={cn(
          "mx-auto p-4 md:p-10",
          location.pathname === '/calendar' ? "max-w-full" : "max-w-5xl"
        )}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
