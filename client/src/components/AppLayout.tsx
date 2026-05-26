import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROLE_LABELS } from "../../../shared/types";
import type { UserRole } from "../../../shared/types";
import {
  LayoutDashboard,
  Target,
  FileText,
  BookOpen,
  FolderOpen,
  Users,
  Building2,
  TrendingUp,
  Globe,
  FileSignature,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  Zap,
  LogOut,
  User,
  Menu,
  X,
  Sparkles,
  Package,
  Shield,
  Calendar,
  ScanText,
  HelpCircle,
  Library,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Pursuits", href: "/pursuits", icon: Target },
  { label: "Proposals", href: "/proposals", icon: FileText },
  { label: "Pipeline", href: "/pipeline", icon: TrendingUp },
  { label: "Opportunities", href: "/opportunities", icon: Globe, badge: "AI" },
  { label: "Knowledge Hub", href: "/knowledge-hub", icon: BookOpen },
  { label: "Assets (DAM)", href: "/assets", icon: FolderOpen },
  { label: "Personnel", href: "/personnel", icon: Users },
  { label: "Projects", href: "/projects", icon: Building2 },
  { label: "Contracts", href: "/contracts", icon: FileSignature, roles: ["administrator", "executive", "contract_manager", "admin"] },
  { label: "Compliance", href: "/compliance", icon: Shield, roles: ["administrator", "executive", "contract_manager", "admin"] },
  { label: "Contract Analyzer", href: "/contract-analyzer", icon: ScanText, badge: "AI", roles: ["administrator", "contract_manager", "admin"] },
  { label: "Bid Calendar", href: "/bid-calendar", icon: Calendar },
  { label: "Glossary", href: "/glossary", icon: BookOpen },
  { label: "AI Tools", href: "/ai-tools", icon: Sparkles, badge: "AI" },
  { label: "InDesign Export", href: "/indesign-export", icon: Package },
  { label: "Analytics", href: "/analytics", icon: BarChart3, roles: ["administrator", "executive", "business_development", "admin"] },
  { label: "Resource Library", href: "/resource-library", icon: Library },
  { label: "Help", href: "/help", icon: HelpCircle },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["administrator", "admin"] },
];

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  const userRole = (user?.role as UserRole) ?? "read_only";

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "AP";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
        collapsed && "justify-center px-2"
      )}>
        <div className="w-9 h-9 rounded-xl bg-amplify-gradient flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display font-800 text-sidebar-foreground text-sm leading-tight">
              Amplify
            </div>
            <div className="text-xs text-sidebar-foreground/60 font-medium tracking-wide">
              PROPOSALS
            </div>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        <div className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Tooltip key={item.href} delayDuration={collapsed ? 200 : 9999}>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <div className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 group",
                      collapsed && "justify-center px-2",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}>
                      <Icon className={cn(
                        "w-4.5 h-4.5 flex-shrink-0 transition-colors",
                        isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                      )} />
                      {!collapsed && (
                        <span className="text-sm flex-1 min-w-0 truncate">{item.label}</span>
                      )}
                      {!collapsed && item.badge && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amplify-blue text-white font-semibold">
                          {item.badge}
                        </Badge>
                      )}
                      {isActive && !collapsed && (
                        <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary flex-shrink-0" />
                      )}
                    </div>
                  </Link>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                    {item.badge && <span className="ml-1 text-amplify-blue-light">({item.badge})</span>}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className={cn(
        "border-t border-sidebar-border p-3",
        collapsed && "flex justify-center"
      )}>
        {isAuthenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center gap-3 w-full rounded-lg p-2 hover:bg-sidebar-accent/50 transition-colors text-left",
                collapsed && "justify-center w-auto"
              )}>
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="bg-amplify-blue text-white text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-sidebar-foreground truncate">
                      {user.name || "User"}
                    </div>
                    <div className="text-xs text-sidebar-foreground/50 truncate">
                      {ROLE_LABELS[userRole] ?? userRole}
                    </div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <div className="px-3 py-2 border-b">
                <div className="font-semibold text-sm">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
              <DropdownMenuItem asChild>
                <Link href="/settings"><div className="flex items-center gap-2 cursor-pointer"><User className="w-4 h-4" /> Profile & Settings</div></Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            size="sm"
            className="w-full bg-amplify-blue hover:bg-amplify-blue-dark text-white"
            onClick={() => window.location.href = getLoginUrl()}
          >
            Sign In
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0 transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}>
        <SidebarContent />
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-full w-5 h-10 bg-sidebar border border-sidebar-border rounded-r-md flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors z-10"
          style={{ left: collapsed ? "3.75rem" : "14.75rem" }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-sidebar flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-border bg-card flex items-center gap-3 px-4 flex-shrink-0">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            {title && (
              <h1 className="font-display font-700 text-base text-foreground truncate">{title}</h1>
            )}
          </div>

          {/* Global Search */}
          <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground text-sm transition-colors">
            <Search className="w-4 h-4" />
            <span>Search everything...</span>
            <kbd className="ml-2 text-xs bg-background border border-border rounded px-1.5 py-0.5">⌘K</kbd>
          </button>

          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amplify-rose rounded-full" />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
