import { useState } from "react";
import { useTranslation } from "react-i18next";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  Search,
  FolderOpen,
  Trash2,
  Loader2,
  Package,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InstalledSkillDialog } from "@/components/skill/InstalledSkillDialog";
import {
  useInstalledSkills,
  useUninstallSkill,
  useSkillsDirectory,
  skillKeys,
} from "@/hooks/useSkills";
import { useQueryClient } from "@tanstack/react-query";
import type { InstalledSkill } from "@/lib/api/skills";

export function InstalledPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<InstalledSkill | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: skills = [], isLoading, error } = useInstalledSkills();
  const { data: skillsDir } = useSkillsDirectory();
  const queryClient = useQueryClient();
  const uninstallMutation = useUninstallSkill();

  // Filter skills
  const filteredSkills = skills.filter(
    (skill) =>
      searchQuery === "" ||
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle uninstall
  const handleUninstall = async (skill: InstalledSkill): Promise<boolean> => {
    console.log("[InstalledPage] Starting uninstall for skill:", skill.id, skill.name);

    console.log("[InstalledPage] Calling mutation with id:", skill.id);
    setUninstallingId(skill.id);
    try {
      await uninstallMutation.mutateAsync(skill.id);
      console.log("[InstalledPage] Uninstall mutation successful");
      void queryClient.refetchQueries({ queryKey: skillKeys.installed() });
      return true;
    } catch (err) {
      console.error("[InstalledPage] Uninstall mutation failed:", err);
      return false;
    } finally {
      setUninstallingId(null);
    }
  };

  // Open skills directory
  const openDirectory = async () => {
    if (skillsDir) {
      try {
        await revealItemInDir(skillsDir);
      } catch (err) {
        console.error("Failed to open directory:", err);
      }
    }
  };

  // Handle card click
  const handleCardClick = (skill: InstalledSkill) => {
    setSelectedSkill(skill);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{t("installed.title")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("installed.subtitle")}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={openDirectory}>
              <FolderOpen className="mr-2 h-4 w-4" />
              {t("installed.openFolder") || "打开目录"}
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive">{t("errors.network")}</p>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium mb-2">{t("installed.empty")}</p>
            <p className="text-sm text-muted-foreground">
              {t("installed.emptyHint") || "在商店中浏览并安装技能"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSkills.map((skill) => (
              <Card
                key={skill.id}
                className="hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => handleCardClick(skill)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{skill.name}</CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {skill.path}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUninstall(skill);
                      }}
                      disabled={uninstallingId === skill.id}
                    >
                      {uninstallingId === skill.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{skill.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="border-t px-6 py-2 text-sm text-muted-foreground">
        {skills.length} {t("installed.title")}
        {skillsDir && (
          <span className="ml-4 text-xs">{skillsDir}</span>
        )}
      </div>

      {/* Installed Skill Dialog */}
      <InstalledSkillDialog
        skill={selectedSkill}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedSkill(null);
        }}
        onUninstall={() => {
          if (!selectedSkill) return;
          return handleUninstall(selectedSkill);
        }}
      />
    </div>
  );
}
