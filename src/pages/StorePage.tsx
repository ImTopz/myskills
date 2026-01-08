import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SkillCard } from "@/components/skill/SkillCard";
import { SkillDetailDialog } from "@/components/skill/SkillDetailDialog";
import {
  useStoreSkills,
  useSyncRepositories,
  useInstallSkill,
  useInstalledSkills,
  useUninstallSkill,
  skillKeys,
} from "@/hooks/useSkills";
import { useQueryClient } from "@tanstack/react-query";
import type { Skill, SkillCategory } from "@/lib/api/skills";

const categories: { id: SkillCategory | "all"; labelKey: string }[] = [
  { id: "all", labelKey: "store.categories.all" },
  { id: "development", labelKey: "store.categories.development" },
  { id: "data", labelKey: "store.categories.data" },
  { id: "writing", labelKey: "store.categories.writing" },
  { id: "business", labelKey: "store.categories.business" },
  { id: "creative", labelKey: "store.categories.creative" },
  { id: "productivity", labelKey: "store.categories.productivity" },
  { id: "other", labelKey: "store.categories.other" },
];

export function StorePage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | "all">("all");
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const didAutoSync = useRef(false);

  const { data: skills = [], isLoading, error, dataUpdatedAt } = useStoreSkills();
  const { data: installedSkills = [] } = useInstalledSkills();
  const queryClient = useQueryClient();
  const syncMutation = useSyncRepositories();
  const installMutation = useInstallSkill();
  const uninstallMutation = useUninstallSkill();

  // Auto sync on first load only if cache is empty
  // Use dataUpdatedAt to check if we already have data from this session
  useEffect(() => {
    // Skip if already synced in this component lifecycle
    if (didAutoSync.current) return;
    // Skip if we already have skills data
    if (skills.length > 0) return;
    // Skip if query has been updated (meaning we already have data from cache)
    if (dataUpdatedAt > 0 && skills.length === 0) {
      // Cache exists but is empty, trigger sync
      didAutoSync.current = true;
      console.log("[StorePage] Cache empty, starting sync...");
      syncMutation.mutate(undefined, {
        onSuccess: (result) => {
          console.log("[StorePage] Sync success:", result);
          setSyncError(null);
        },
        onError: (error) => {
          console.error("[StorePage] Sync failed:", error);
          setSyncError(error.message);
        },
      });
      return;
    }
    // First mount with no data
    didAutoSync.current = true;
    console.log("[StorePage] First mount, starting sync...");
    syncMutation.mutate(undefined, {
      onSuccess: (result) => {
        console.log("[StorePage] Sync success:", result);
        setSyncError(null);
      },
      onError: (error) => {
        console.error("[StorePage] Sync failed:", error);
        setSyncError(error.message);
      },
    });
  }, []);  // Empty deps - only run once on mount

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    setSyncError(null);
    syncMutation.mutate(undefined, {
      onSuccess: (result) => {
        console.log("[StorePage] Manual sync success:", result);
        if (!result.success) {
          setSyncError(result.message);
        }
      },
      onError: (error) => {
        console.error("[StorePage] Manual sync failed:", error);
        setSyncError(error.message);
      },
    });
  }, [syncMutation]);

  // Filter skills
  const filteredSkills = skills.filter((skill) => {
    const matchesSearch =
      searchQuery === "" ||
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || skill.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Check if skill is installed
  const isInstalled = (skill: Skill) => {
    return installedSkills.some(
      (installed) => installed.id === skill.path || installed.name === skill.name
    );
  };

  // Handle install
  const handleInstall = async (skill: Skill) => {
    console.log("[StorePage] Installing skill:", skill.id);
    setInstallingId(skill.id);
    try {
      await installMutation.mutateAsync(skill.id);
      console.log("[StorePage] Install mutation completed, waiting for data refresh...");
      // Wait for data to be refreshed (onSuccess in hook does this, but we need to wait)
      await queryClient.refetchQueries({ queryKey: skillKeys.installed() });
      console.log("[StorePage] Data refresh completed");
    } catch (err) {
      console.error("[StorePage] Install failed:", err);
    } finally {
      setInstallingId(null);
    }
  };

  // Handle uninstall
  const handleUninstall = async (skill: Skill) => {
    console.log("[StorePage] Uninstalling skill:", skill.path);
    try {
      await uninstallMutation.mutateAsync(skill.path);
      console.log("[StorePage] Uninstall mutation completed, waiting for data refresh...");
      await queryClient.refetchQueries({ queryKey: skillKeys.installed() });
      console.log("[StorePage] Data refresh completed");
    } catch (err) {
      console.error("[StorePage] Uninstall failed:", err);
    }
  };

  // Handle card click
  const handleCardClick = (skill: Skill) => {
    setSelectedSkill(skill);
    setDialogOpen(true);
  };

  const showLoading = isLoading || (skills.length === 0 && syncMutation.isPending);
  const showError = Boolean(error) || (skills.length === 0 && syncMutation.isError);
  const showRateLimitWarning = syncError?.includes("Rate limited") && skills.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Rate Limit Warning Banner */}
      {showRateLimitWarning && (
        <div className="px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{t("errors.rateLimit") || "GitHub API 请求频率受限，请稍后再试"}</span>
        </div>
      )}
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{t("store.title")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("store.subtitle")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("common.refresh")}
            </Button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("store.searchPlaceholder")}
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-6 pb-2 flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "secondary" : "ghost"}
              size="sm"
              className="shrink-0"
              onClick={() => setSelectedCategory(cat.id)}
            >
              {t(cat.labelKey)}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {showLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : showError ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-destructive mb-4">{t("errors.network")}</p>
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate()}
            >
              {t("common.refresh")}
            </Button>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{t("store.noResults")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isInstalled={isInstalled(skill)}
                isInstalling={installingId === skill.id}
                onInstall={() => handleInstall(skill)}
                onUninstall={() => handleUninstall(skill)}
                onClick={() => handleCardClick(skill)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="border-t px-6 py-2 text-sm text-muted-foreground">
        {filteredSkills.length} / {skills.length} {t("nav.store")}
      </div>

      {/* Skill Detail Dialog */}
      <SkillDetailDialog
        skill={selectedSkill}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isInstalled={selectedSkill ? isInstalled(selectedSkill) : false}
        isInstalling={selectedSkill ? installingId === selectedSkill.id : false}
        onInstall={() => selectedSkill && handleInstall(selectedSkill)}
        onUninstall={() => selectedSkill && handleUninstall(selectedSkill)}
      />
    </div>
  );
}
