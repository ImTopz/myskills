import { useState } from "react";
import { useTranslation } from "react-i18next";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Globe, Moon, Sun, FolderOpen, Trash2, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSkillsDirectory, useRepositories, useAddRepository, useRemoveRepository } from "@/hooks/useSkills";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { data: skillsDir } = useSkillsDirectory();
  const { data: repositories, isLoading: reposLoading } = useRepositories();
  const addRepoMutation = useAddRepository();
  const removeRepoMutation = useRemoveRepository();

  const [newRepoInput, setNewRepoInput] = useState("");
  const [repoError, setRepoError] = useState<string | null>(null);

  const parseRepositoryInput = (
    input: string
  ): { owner: string; repo: string; basePath?: string; gitRef?: string } | null => {
    const raw = input.trim();
    if (!raw) return null;

    // 1) Full URL: https://github.com/<owner>/<repo>[/tree/<ref>/<path>...]
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      try {
        const url = new URL(raw);
        const host = url.hostname.toLowerCase();

        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length < 2) return null;

        // raw.githubusercontent.com/<owner>/<repo>/<ref>/<path...>
        if (host === "raw.githubusercontent.com") {
          if (parts.length < 3) return null;
          const owner = parts[0];
          const repo = parts[1].replace(/\.git$/i, "");
          const gitRef = parts[2];
          let basePath: string | undefined = parts.slice(3).join("/") || undefined;

          if (basePath?.toLowerCase().endsWith("skill.md")) {
            basePath = basePath.replace(/\/?SKILL\.md$/i, "");
          }

          basePath = basePath?.replace(/^\/+|\/+$/g, "");
          if (!basePath) basePath = undefined;

          return { owner, repo, basePath, gitRef };
        }

        if (host !== "github.com" && host !== "www.github.com") return null;

        const owner = parts[0];
        const repo = parts[1].replace(/\.git$/i, "");
        let gitRef: string | undefined;
        let basePath: string | undefined;

        if (parts[2] === "tree" || parts[2] === "blob") {
          gitRef = parts[3];
          basePath = parts.slice(4).join("/");
        }

        if (basePath?.toLowerCase().endsWith("skill.md")) {
          basePath = basePath.replace(/\/?SKILL\.md$/i, "");
        }

        basePath = basePath?.replace(/^\/+|\/+$/g, "");
        if (!basePath) basePath = undefined;

        return { owner, repo, basePath, gitRef };
      } catch {
        return null;
      }
    }

    // 2) SSH URL: git@github.com:<owner>/<repo>.git
    if (raw.startsWith("git@github.com:")) {
      const rest = raw.slice("git@github.com:".length);
      const [owner, repoWithGit] = rest.split("/", 2);
      if (!owner || !repoWithGit) return null;
      const repo = repoWithGit.replace(/\.git$/i, "");
      return { owner, repo };
    }

    // 3) owner/repo[/path...]
    const parts = raw.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    const basePath = parts.length > 2 ? parts.slice(2).join("/") : undefined;

    return { owner, repo, basePath };
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === "zh" ? "en" : "zh";
    i18n.changeLanguage(newLang);
    try {
      window.localStorage.setItem("myskills.language", newLang);
    } catch {
      // ignore
    }
  };

  const openSkillsDirectory = async () => {
    if (!skillsDir) return;
    try {
      await revealItemInDir(skillsDir);
    } catch (err) {
      console.error("Failed to open directory:", err);
    }
  };

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
  };

  const handleAddRepository = () => {
    setRepoError(null);
    const input = newRepoInput.trim();
    if (!input) return;

    const parsed = parseRepositoryInput(input);
    if (!parsed) {
      setRepoError(t("settings.repositories.invalidFormat") || "请使用 owner/repo 格式");
      return;
    }

    addRepoMutation.mutate(
      parsed,
      {
        onSuccess: () => {
          setNewRepoInput("");
          setRepoError(null);
        },
        onError: (error) => {
          setRepoError(error.message);
        },
      }
    );
  };

  const handleRemoveRepository = (repoId: string) => {
    setRepoError(null);
    removeRepoMutation.mutate(repoId, {
      onError: (error) => setRepoError(error.message),
    });
  };

  const builtinRepos = repositories?.filter((r) => r.is_builtin) || [];
  const customRepos = repositories?.filter((r) => !r.is_builtin) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Repository Management */}
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.repositories.title")}</CardTitle>
              <CardDescription>
                {t("settings.repositories.description") || "管理 Skills 来源仓库"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Built-in Repositories */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t("settings.repositories.builtin")}
                </h4>
                <div className="space-y-2">
                  {reposLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    builtinRepos.map((repo) => (
                      <div
                        key={repo.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted"
                      >
                        <div>
                          <p className="font-medium">{repo.url}</p>
                          <p className="text-xs text-muted-foreground">
                            {repo.name}
                            {repo.skill_count !== undefined && ` · ${repo.skill_count} skills`}
                            {repo.last_synced && ` · ${t("settings.repositories.lastSynced")}: ${new Date(repo.last_synced).toLocaleDateString()}`}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground px-2 py-1 bg-background rounded">
                          {t("settings.repositories.builtinBadge") || "内置"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Custom Repositories */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t("settings.repositories.custom")}
                </h4>

                {/* Custom repo list */}
                {customRepos.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {customRepos.map((repo) => (
                      <div
                        key={repo.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted"
                      >
                        <div>
                          <p className="font-medium">{repo.url}</p>
                          <p className="text-xs text-muted-foreground">
                            {repo.skill_count !== undefined && `${repo.skill_count} skills`}
                            {repo.last_synced && ` · ${new Date(repo.last_synced).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveRepository(repo.id)}
                          disabled={removeRepoMutation.isPending}
                        >
                          {removeRepoMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new repo */}
                <div className="flex gap-2">
                  <Input
                    placeholder="owner/repo 或 GitHub URL"
                    className="flex-1"
                    value={newRepoInput}
                    onChange={(e) => setNewRepoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddRepository();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleAddRepository}
                    disabled={addRepoMutation.isPending || !newRepoInput.trim()}
                  >
                    {addRepoMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {repoError && (
                  <p className="text-sm text-destructive mt-2">{repoError}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cache Settings */}
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.cache.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t("settings.cache.skillsDir") || "Skills 目录"}</p>
                  <p className="text-sm text-muted-foreground">{skillsDir || "~/.claude/skills"}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openSkillsDirectory}
                  disabled={!skillsDir}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t("installed.openFolder") || "打开"}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t("settings.cache.clear")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.cache.clearHint") || "清除缓存的 Skills 数据"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  disabled
                  title={t("settings.cache.notImplemented") || "缓存功能尚未实现"}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("settings.cache.clear")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.appearance.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Theme */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t("settings.appearance.theme")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.appearance.themeHint") || "切换明暗主题"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleTheme}>
                  <Sun className="h-4 w-4 mr-2 dark:hidden" />
                  <Moon className="h-4 w-4 mr-2 hidden dark:block" />
                  {t("settings.appearance.toggle") || "切换"}
                </Button>
              </div>

              {/* Language */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t("settings.appearance.language")}</p>
                  <p className="text-sm text-muted-foreground">
                    {i18n.language === "zh" ? "简体中文" : "English"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleLanguage}>
                  <Globe className="h-4 w-4 mr-2" />
                  {i18n.language === "zh" ? "EN" : "中文"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.about") || "关于"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">版本:</span> 0.1.0
                </p>
                <p>
                  <span className="text-muted-foreground">作者:</span> Rok1e
                </p>
                <p className="text-muted-foreground">
                  MySkills - Claude Code Skills Manager
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
