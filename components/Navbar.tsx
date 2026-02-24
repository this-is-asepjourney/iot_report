'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { logout } from '@/lib/firebase/auth';
import { Button } from '@/components/ui/button';
import { Home, Wrench, Plus, List, Upload, User, Settings, LogOut, AlertTriangle, Menu, X, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: 'Logout berhasil',
        description: 'Sampai jumpa!',
      });
      router.push('/login');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Gagal logout',
        variant: 'destructive',
      });
    }
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['teknisi', 'supervisor', 'admin'] },
    { href: '/repair', label: 'Repair', icon: Wrench, roles: ['teknisi', 'supervisor', 'admin'] },
    { href: '/repair-list', label: 'List Error', icon: AlertTriangle, roles: ['teknisi', 'supervisor', 'admin'] },
    { href: '/new-installation', label: 'Install Baru', icon: Plus, roles: ['teknisi', 'supervisor', 'admin'] },
    { href: '/ganti-iot', label: 'Ganti IoT', icon: RefreshCw, roles: ['supervisor', 'admin'] },
    { href: '/device-list', label: 'Device List', icon: List, roles: ['teknisi', 'supervisor', 'admin'] },
    { href: '/import-csv', label: 'Import CSV', icon: Upload, roles: ['supervisor', 'admin'] },
    { href: '/profile', label: 'Profile', icon: User, roles: ['teknisi', 'supervisor', 'admin'] },
    { href: '/admin', label: 'Admin', icon: Settings, roles: ['admin'] },
  ];

  const visibleItems = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="flex items-center justify-between h-14 px-4 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:h-9 md:w-9"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={sidebarOpen ? 'Tutup menu' : 'Buka menu'}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link href="/dashboard" className="text-lg font-bold truncate bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent" onClick={closeSidebar}>
              IoT Report
            </Link>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-[180px]" title={user?.name}>
              {user?.name}
            </span>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={handleLogout} aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Backdrop (mobile & desktop when sidebar open) */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:bg-black/30 transition-opacity"
          aria-label="Tutup menu"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-[280px] max-w-[85vw] bg-card border-r shadow-xl
          flex flex-col
          transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b shrink-0">
          <span className="font-semibold">Menu</span>
          <Button variant="ghost" size="icon" onClick={closeSidebar} aria-label="Tutup menu" className="md:hidden">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}
                `}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground px-3 truncate" title={user?.email}>
            {user?.email}
          </p>
        </div>
      </aside>
    </>
  );
}
