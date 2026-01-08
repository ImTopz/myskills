import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  Package,
  Loader2,
  Trash2,
  FolderOpen,
  FileText,
  Copy,
  Check,
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
import type { InstalledSkill } from "@/lib/api/skills";
import { skillsApi } from "@/lib/api/skills";

interface InstalledSkillDialogProps {
  skill: InstalledSkill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUninstall?: () => void | Promise<boolean | void>;
}

export function InstalledSkillDialog({
  skill,
  open,
  onOpenChange,
  onUninstall,
}: InstalledSkillDialogProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uninstallState, setUninstallState] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [uninstallError, setUninstallError] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  // Load skill content when dialog opens
  useEffect(() => {
    if (open && skill) {
      setLoading(true);
      setContent(null);
      console.log("[InstalledSkillDialog] Loading content for skill:", skill.id, "path:", skill.path);
      skillsApi
        .getSkillContent(skill.id)
        .then((data) => {
          console.log("[InstalledSkillDialog] Content loaded, length:", data?.length);
          setContent(data);
        })
        .catch((err) => {
          console.error("[InstalledSkillDialog] Failed to load skill content:", err);
          setContent(null);
        })
        .finally(() => setLoading(false));
    }
  }, [open, skill]);

  useEffect(() => {
    if (!open) return;
    setUninstallState("idle");
    setUninstallError(null);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, [open, skill?.id]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Copy content to clipboard
  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUninstall = async () => {
    if (!onUninstall) return;
    setUninstallState("pending");
    setUninstallError(null);

    try {
      const result = await onUninstall();
      if (result === false) {
        setUninstallState("error");
        setUninstallError(t("common.error"));
        return;
      }

      setUninstallState("success");
      closeTimerRef.current = window.setTimeout(() => {
        onOpenChange(false);
      }, 650);
    } catch (err) {
      console.error("[InstalledSkillDialog] Uninstall failed:", err);
      setUninstallState("error");
      setUninstallError(err instanceof Error ? err.message : String(err));
    }
  };

  // Open folder
  const handleOpenFolder = async () => {
    if (skill?.path) {
      try {
        await revealItemInDir(skill.path);
      } catch (err) {
        console.error("Failed to open folder:", err);
      }
    }
  };

  if (!skill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl">{skill.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {skill.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Path Info */}
        <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <FolderOpen className="h-4 w-4 flex-shrink-0" />
          <code className="truncate flex-1">{skill.path}</code>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleOpenFolder}
          >
            {t("installed.openFolder") || "打开"}
          </Button>
        </div>

        {/* Skill Content */}
        <div className="flex-1 overflow-auto py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : content ? (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-8 px-2"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap overflow-x-auto max-h-96">
                {content}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>{t("detail.noReadme") || "无法读取 Skill 内容"}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
          {onUninstall && (
            <>
              {uninstallState === "success" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 animate-in fade-in zoom-in duration-200"
                  disabled
                >
                  <Check className="mr-2 h-4 w-4" />
                  {t("common.uninstalled") || "已卸载"}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleUninstall}
                  disabled={uninstallState === "pending"}
                >
                  {uninstallState === "pending" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {uninstallState === "pending"
                    ? t("common.uninstalling") || "卸载中..."
                    : t("common.uninstall")}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
        {uninstallState === "error" && uninstallError && (
          <p className="text-sm text-destructive pt-2">{uninstallError}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
