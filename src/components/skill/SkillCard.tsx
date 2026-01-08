import { useTranslation } from "react-i18next";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Skill, SkillCategory } from "@/lib/api/skills";
import { cn } from "@/lib/utils";

interface SkillCardProps {
  skill: Skill;
  isInstalled?: boolean;
  isInstalling?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  onClick?: () => void;
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

export function SkillCard({
  skill,
  isInstalled = false,
  isInstalling = false,
  onInstall,
  onUninstall,
  onClick,
}: SkillCardProps) {
  const { t } = useTranslation();
  const Icon = categoryIcons[skill.category] || Package;
  const colorClass = categoryColors[skill.category] || categoryColors.other;

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:shadow-md",
        "hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                colorClass
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{skill.name}</CardTitle>
              <span className="text-xs text-muted-foreground">
                {skill.repository}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <CardDescription className="line-clamp-2 min-h-[40px]">
          {skill.description}
        </CardDescription>

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {isInstalled ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-green-600"
                disabled
              >
                <Check className="mr-2 h-4 w-4" />
                {t("common.installed")}
              </Button>
              {onUninstall && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={onUninstall}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <Button
              size="sm"
              className="w-full"
              onClick={onInstall}
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
        </div>
      </CardContent>
    </Card>
  );
}
