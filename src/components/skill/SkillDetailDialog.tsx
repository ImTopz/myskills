import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Code2,
  Database,
  FileText,
  Briefcase,
  Palette,
  Zap,
  Package,
  Loader2,
  Check,
  Trash2,
  ExternalLink,
  User,
  FolderOpen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Skill, SkillCategory } from "@/lib/api/skills";
import { cn } from "@/lib/utils";

interface SkillDetailDialogProps {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isInstalled?: boolean;
  isInstalling?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
}

const categoryIcons: Record<SkillCategory, typeof Code2> = {
  development: Code2,
  data: Database,
  writing: FileText,
  business: Briefcase,
  creative: Palette,
  productivity: Zap,
  other: Package,
};

const categoryColors: Record<SkillCategory, string> = {
  development: "bg-blue-500/10 text-blue-500",
  data: "bg-green-500/10 text-green-500",
  writing: "bg-purple-500/10 text-purple-500",
  business: "bg-orange-500/10 text-orange-500",
  creative: "bg-pink-500/10 text-pink-500",
  productivity: "bg-yellow-500/10 text-yellow-500",
  other: "bg-gray-500/10 text-gray-500",
};

export function SkillDetailDialog({
  skill,
  open,
  onOpenChange,
  isInstalled = false,
  isInstalling = false,
  onInstall,
  onUninstall,
}: SkillDetailDialogProps) {
  const { t } = useTranslation();

  if (!skill) return null;

  const Icon = categoryIcons[skill.category] || Package;
  const colorClass = categoryColors[skill.category] || categoryColors.other;

  // Parse repository URL for GitHub link
  const getGitHubUrl = () => {
    if (skill.repository.includes("/")) {
      const prefix = `${skill.repository}/`;
      const repoPath = skill.id.startsWith(prefix) ? skill.id.slice(prefix.length) : "";
      const gitRef = skill.git_ref || "HEAD";

      if (!repoPath) {
        return `https://github.com/${skill.repository}`;
      }

      const encodedPath = repoPath
        .split("/")
        .filter(Boolean)
        .map((p) => encodeURIComponent(p))
        .join("/");

      return `https://github.com/${skill.repository}/tree/${encodeURIComponent(gitRef)}/${encodedPath}`;
    }
    return null;
  };

  const githubUrl = getGitHubUrl();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg flex-shrink-0",
                colorClass
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl">{skill.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {skill.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Metadata Section */}
        <div className="flex flex-wrap gap-4 py-3 border-b text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span>{skill.repository}</span>
          </div>
          {skill.metadata?.author && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{skill.metadata.author}</span>
            </div>
          )}
          <Badge variant="secondary" className="capitalize">
            {t(`store.categories.${skill.category}`)}
          </Badge>
        </div>

        {/* Tags */}
        {skill.metadata?.tags && skill.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 py-2">
            {skill.metadata.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* README Content */}
        <div className="flex-1 overflow-auto py-4">
          {skill.readme ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                {skill.readme}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>{t("detail.noReadme") || "暂无详细说明"}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
          {githubUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                openUrl(githubUrl).catch((err: unknown) => {
                  console.error("Failed to open external link:", err);
                });
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("detail.viewOnGitHub") || "在 GitHub 查看"}
            </Button>
          )}

          {isInstalled ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-green-600"
                disabled
              >
                <Check className="mr-2 h-4 w-4" />
                {t("common.installed")}
              </Button>
              {onUninstall && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onUninstall();
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("common.uninstall")}
                </Button>
              )}
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                onInstall?.();
              }}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                t("common.install")
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
