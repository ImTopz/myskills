import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Store, Package, PlusCircle, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PageType = "store" | "installed" | "create" | "settings";

interface LayoutProps {
  children: ReactNode;
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
}

const navItems: { id: PageType; icon: typeof Store; labelKey: string }[] = [
  { id: "store", icon: Store, labelKey: "nav.store" },
  { id: "installed", icon: Package, labelKey: "nav.installed" },
  { id: "create", icon: PlusCircle, labelKey: "nav.create" },
  { id: "settings", icon: Settings, labelKey: "nav.settings" },
];

export function Layout({ children, currentPage, onPageChange }: LayoutProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r bg-card transition-all duration-300",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b px-4">
          {!collapsed && (
            <h1 className="text-lg font-bold text-primary">MySkills</h1>
          )}
          {collapsed && (
            <span className="text-lg font-bold text-primary">MS</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <Button
                key={item.id}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  collapsed ? "px-2" : "px-3"
                )}
                onClick={() => onPageChange(item.id)}
              >
                <Icon className={cn("h-5 w-5", collapsed ? "" : "mr-3")} />
                {!collapsed && <span>{t(item.labelKey)}</span>}
              </Button>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>{t("common.collapse") || "收起"}</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
