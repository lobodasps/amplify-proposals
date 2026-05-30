import { useState, useEffect } from "react";
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
  ChevronDown,
  Bell,
  Search,
  Zap,
  LogOut,
  User,
  Menu,
  Sparkles,
  Package,
  Shield,
  Calendar,
  ScanText,
  HelpCircle,
  Library,
  Code2,
  Cpu,
  BarChart2,
  AlertTriangle,
  Briefcase,
  Brain,
  Gavel,
  LineChart,
  HardDrive,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  roles?: UserRole[];
  /** Short description shown as a tooltip subtitle when sidebar is expanded */
  description?: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  /** Lifecycle step number — shown as a subtle indicator */
  step?: number;
  items: NavItem[];
  /** If true, always visible (no collapse) */
  pinned?: boolean;
  roles?: UserRole[];
}

// ─── Navigation Structure (Option A+C) ───────────────────────────────────────
// Groups follow the BD lifecycle: Find → Pursue → Propose → Win → Manage
// Each group is collapsible; the active group auto-expands.

const NAV_GROUPS: NavGroup[] = [
  {
    id: "home",
    label: "Home",
    icon: LayoutDashboard,
    pinned: true,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Overview & KPIs" },
    ],
  },
  {
    id: "business_dev",
    label: "Business Development",
    icon: Globe,
    step: 1,
    items: [
      {
        label: "Opportunities",
        href: "/opportunities",
        icon: Globe,
        badge: "AI",
        description: "Raw leads & solicitations to evaluate",
      },
      {
        label: "Bid Calendar",
        href: "/bid-calendar",
        icon: Calendar,
        description: "Upcoming deadlines & pre-bid meetings",
      },
      {
        label: "Pipeline",
        href: "/pipeline",
        icon: TrendingUp,
        description: "Committed bids being tracked",
      },
    ],
  },
  {
    id: "pursuits",
    label: "Pursuits & Proposals",
    icon: Target,
    step: 2,
    items: [
      {
        label: "Proposal Launchpad",
        href: "/launch",
        icon: Rocket,
        badge: "AI",
        description: "Upload RFP, extract info, and get instant Go/No-Go",
      },
      {
        label: "Pursuits",
        href: "/pursuits",
        icon: Target,
        description: "Active go/no-go decisions & pursuit plans",
      },
      {
        label: "Proposals",
        href: "/proposals",
        icon: FileText,
        description: "Proposal workspaces & drafts",
      },
      {
        label: "Proposal Scorer",
        href: "/proposal-scorer",
        icon: BarChart2,
        badge: "AI",
        description: "Score proposals against RFP criteria",
      },
      {
        label: "InDesign Export",
        href: "/indesign-export",
        icon: Package,
        description: "Export formatted proposal to InDesign",
      },
    ],
  },
  {
    id: "rfp_intelligence",
    label: "RFP Intelligence",
    icon: Brain,
    step: 3,
    items: [
      {
        label: "Doc Shredder",
        href: "/document-shredder",
        icon: Code2,
        badge: "AI",
        description: "Parse & shred RFP files into structured XML",
      },
      {
        label: "RFP Wiki",
        href: "/rfp-wiki",
        icon: Cpu,
        badge: "AI",
        description: "Hybrid index + Q&A over shredded RFPs",
      },
      {
        label: "Conflict Detector",
        href: "/conflict-detector",
        icon: AlertTriangle,
        badge: "AI",
        description: "Find contradictions across RFP documents",
      },
      {
        label: "Agent Guidelines",
        href: "/agent-guidelines",
        icon: Target,
        badge: "AI",
        description: "AI advisor for proposal strategy",
      },
      {
        label: "AI Tools",
        href: "/ai-tools",
        icon: Sparkles,
        badge: "AI",
        description: "General AI writing & analysis tools",
      },
    ],
  },
  {
    id: "firm_records",
    label: "Firm Records",
    icon: BookOpen,
    items: [
      {
        label: "Staff",
        href: "/staff",
        icon: Users,
        description: "Team members, resumes & certifications",
      },
      {
        label: "Projects",
        href: "/projects",
        icon: Building2,
        description: "Past project experience with attachments",
      },
      {
        label: "Knowledge Hub",
        href: "/knowledge-hub",
        icon: HardDrive,
        description: "Upload & manage proposals, project sheets, resumes, certifications",
      },
      {
        label: "Resource Library",
        href: "/resource-library",
        icon: Library,
        description: "Templates, boilerplate & rate sheets",
      },
      {
        label: "Glossary",
        href: "/glossary",
        icon: BookOpen,
        description: "Terms, acronyms & definitions",
      },
    ],
  },
  {
    id: "contracts",
    label: "Contracts & Compliance",
    icon: Gavel,
    step: 4,
    items: [
      {
        label: "Contracts",
        href: "/contracts",
        icon: FileSignature,
        description: "Active & awarded contracts",
      },
      {
        label: "Contract Analyzer",
        href: "/contract-analyzer",
        icon: ScanText,
        badge: "AI",
        description: "AI review of contract terms & risks",
      },
      {
        label: "Compliance",
        href: "/compliance",
        icon: Shield,
        description: "Compliance tracking & certifications",
      },
    ],
  },
  {
    id: "reports_admin",
    label: "Reports & Admin",
    icon: LineChart,
    items: [
      {
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        description: "Win rates, pipeline metrics & trends",
        roles: ["administrator", "executive", "business_development", "admin"],
      },
      {
        label: "QB Sync",
        href: "/qb-sync",
        icon: RefreshCw,
        description: "Bulk import billed amounts from QuickBooks",
        roles: ["administrator", "admin", "project_manager"],
      },
      {
        label: "Help",
        href: "/help",
        icon: HelpCircle,
        description: "Documentation & support",
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Account & system settings",
        roles: ["administrator", "admin"],
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupContainsPath(group: NavGroup, path: string): boolean {
  return group.items.some(
    (item) => path === item.href || path.startsWith(item.href + "/")
  );
}

// ─── Sidebar Nav Group ────────────────────────────────────────────────────────

function NavGroupSection({
  group,
  userRole,
  location,
  collapsed,
  isOpen,
  onToggle,
}: {
  group: NavGroup;
  userRole: UserRole;
  location: string;
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const GroupIcon = group.icon;
  const isActive = groupContainsPath(group, location);

  const visibleItems = group.items.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  if (visibleItems.length === 0) return null;

  // When sidebar is collapsed, render items directly with tooltips (no group headers)
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {/* Collapsed group divider */}
        <div className="h-px bg-sidebar-border/50 mx-2 my-1" />
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const itemActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Tooltip key={item.href} delayDuration={100}>
              <TooltipTrigger asChild>
                <Link href={item.href}>
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 mx-auto rounded-lg cursor-pointer transition-all duration-150",
                    itemActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}>
                    <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium max-w-[200px]">
                <div>
                  <div>{item.label}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground font-normal mt-0.5">{item.description}</div>
                  )}
                </div>
                {item.badge && <span className="ml-1 text-amplify-blue-light">({item.badge})</span>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  // Expanded sidebar: show collapsible group header + items
  return (
    <div className="mb-1">
      {/* Group header */}
      {!group.pinned && (
        <button
          onClick={onToggle}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors duration-150 group",
            isActive
              ? "text-sidebar-foreground"
              : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
          )}
        >
          <GroupIcon className={cn(
            "w-4 h-4 flex-shrink-0 transition-colors",
            isActive ? "text-sidebar-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60"
          )} />
          <span className="text-xs font-semibold uppercase tracking-wider flex-1 truncate">
            {group.label}
          </span>
          {group.step && (
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
              isActive
                ? "bg-sidebar-primary/20 text-sidebar-primary"
                : "bg-sidebar-border text-sidebar-foreground/40"
            )}>
              {group.step}
            </span>
          )}
          <ChevronDown className={cn(
            "w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200",
            isOpen ? "rotate-0" : "-rotate-90",
            isActive ? "text-sidebar-foreground/70" : "text-sidebar-foreground/30"
          )} />
        </button>
      )}

      {/* Items */}
      <div className={cn(
        "overflow-hidden transition-all duration-200 ease-in-out",
        (isOpen || group.pinned) ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className={cn("space-y-0.5", !group.pinned && "pl-2 pt-0.5")}>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const itemActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 group",
                  itemActive
                    ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}>
                  <Icon className={cn(
                    "w-4 h-4 flex-shrink-0 transition-colors",
                    itemActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                  )} />
                  <span className="text-sm flex-1 min-w-0 truncate">{item.label}</span>
                  {item.badge && (
                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amplify-blue text-white font-semibold flex-shrink-0">
                      {item.badge}
                    </Badge>
                  )}
                  {itemActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary flex-shrink-0" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

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

  // Track which groups are open — default: open the group containing the current path
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    // Always open key groups by default so users can see them immediately
    const alwaysOpen = new Set(["pursuits", "contracts"]);
    NAV_GROUPS.forEach((g) => {
      initial[g.id] = groupContainsPath(g, location) || g.pinned === true || alwaysOpen.has(g.id);
    });
    return initial;
  });

  // Auto-expand the group when navigating to a page inside it
  useEffect(() => {
    NAV_GROUPS.forEach((g) => {
      if (groupContainsPath(g, location)) {
        setOpenGroups((prev) => ({ ...prev, [g.id]: true }));
      }
    });
  }, [location]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        {/* Lifecycle hint — only shown when expanded */}
        {!collapsed && (
          <div className="px-3 mb-3">
            <p className="text-[10px] text-sidebar-foreground/30 uppercase tracking-widest font-semibold">
              BD Lifecycle
            </p>
          </div>
        )}

        <div className="space-y-0.5">
          {NAV_GROUPS.map((group) => {
            // Check if the whole group is role-gated
            if (group.roles && !group.roles.includes(userRole)) return null;
            return (
              <NavGroupSection
                key={group.id}
                group={group}
                userRole={userRole}
                location={location}
                collapsed={collapsed}
                isOpen={openGroups[group.id] ?? false}
                onToggle={() => toggleGroup(group.id)}
              />
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
                <Link href="/settings">
                  <div className="flex items-center gap-2 cursor-pointer">
                    <User className="w-4 h-4" /> Profile & Settings
                  </div>
                </Link>
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
        "hidden md:flex flex-col relative bg-sidebar border-r border-sidebar-border flex-shrink-0 transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}>
        <SidebarContent />
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-1/2 -translate-y-1/2 w-5 h-10 bg-sidebar border border-sidebar-border rounded-r-md flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors z-10"
          style={{ right: "-1.25rem" }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-sidebar flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-border bg-card flex items-center gap-3 px-4 flex-shrink-0">
          <button
            className="md:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
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
