import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileCode,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  CheckCircle2,
  Upload,
  Trash2,
  File,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCreateCustomSkill } from "@/hooks/useSkills";
import type { CreateSkillFile } from "@/lib/api/skills";

interface SkillFormData {
  name: string;
  description: string;
  instructions: string;
  examples: string;
}

type ResourceFileItem = {
  id: string;
  file: File;
  targetPath: string;
};

const steps = [
  { id: 1, labelKey: "create.steps.basic" },
  { id: 2, labelKey: "create.steps.instructions" },
  { id: 3, labelKey: "create.steps.examples" },
  { id: 4, labelKey: "create.steps.review" },
];

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function sanitizePathSegment(segment: string) {
  return segment
    .replace(/[\\/]+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .slice(0, 120);
}

export function CreatePage() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [resourceFiles, setResourceFiles] = useState<ResourceFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [preparingResources, setPreparingResources] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState<SkillFormData>({
    name: "",
    description: "",
    instructions: "",
    examples: "",
  });

  const createSkillMutation = useCreateCustomSkill();

  const updateForm = (field: keyof SkillFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim() !== "" && formData.description.trim() !== "";
      case 2:
        return formData.instructions.trim() !== "";
      case 3:
        return true; // Examples are optional
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleCreate = async () => {
    setCreateError(null);
    setPreparingResources(true);

    try {
      const resources: CreateSkillFile[] = await Promise.all(
        resourceFiles.map(async (item) => {
          const buffer = await item.file.arrayBuffer();
          const bytes = Array.from(new Uint8Array(buffer));
          return { relativePath: item.targetPath, content: bytes };
        })
      );

      createSkillMutation.mutate(
        {
          name: formData.name,
          description: formData.description,
          instructions: formData.instructions,
          examples: formData.examples || undefined,
          resources: resources.length > 0 ? resources : undefined,
        },
        {
          onSuccess: (path) => {
            setCreatedPath(path);
          },
          onError: (error) => {
            setCreateError(error.message);
          },
        }
      );
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreparingResources(false);
    }
  };

  const handleReset = () => {
    setFormData({ name: "", description: "", instructions: "", examples: "" });
    setResourceFiles([]);
    setCurrentStep(1);
    setCreatedPath(null);
    setCreateError(null);
    createSkillMutation.reset();
  };

  const generateSkillMd = () => {
    const skillName = formData.name
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^a-z0-9-_]/g, "");

    return `---
name: ${skillName}
description: ${formData.description}
author: custom
---

# ${formData.name}

${formData.description}

## Instructions

${formData.instructions}
${formData.examples ? `\n## Examples\n\n${formData.examples}` : ""}`;
  };

  const addResourceFiles = (files: File[] | FileList | null | undefined) => {
    if (!files) return;
    const list = Array.isArray(files) ? files : Array.from(files);
    if (list.length === 0) return;

    setResourceFiles((prev) => {
      const used = new Set(prev.map((f) => f.targetPath.toLowerCase()));
      const next = [...prev];

      for (const file of list) {
        if (!file || !file.name) continue;

        const rawRelative =
          (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const parts = rawRelative
          .split(/[\\/]/g)
          .map((p) => p.trim())
          .filter((p) => p && p !== "." && p !== "..")
          .map((p) => sanitizePathSegment(p))
          .filter(Boolean);

        const safePath = parts.length > 0 ? parts.join("/") : sanitizePathSegment(file.name);
        const baseTarget = `resources/${safePath || "file"}`;

        let targetPath = baseTarget;
        if (used.has(targetPath.toLowerCase())) {
          const dot = targetPath.lastIndexOf(".");
          const hasExt = dot > targetPath.lastIndexOf("/");
          const prefix = hasExt ? targetPath.slice(0, dot) : targetPath;
          const ext = hasExt ? targetPath.slice(dot) : "";
          let i = 2;
          while (used.has(`${prefix}-${i}${ext}`.toLowerCase())) i += 1;
          targetPath = `${prefix}-${i}${ext}`;
        }

        used.add(targetPath.toLowerCase());

        next.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          file,
          targetPath,
        });
      }

      return next;
    });
  };

  const removeResourceFile = (id: string) => {
    setResourceFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Success state
  if (createdPath) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h1 className="text-2xl font-bold">{t("create.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("create.subtitle")}</p>
        </div>

        {/* Success Content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">
                {t("create.success.title") || "Skill 创建成功！"}
              </h2>
              <p className="text-muted-foreground mb-4">
                {t("create.success.message") || "你的自定义 Skill 已保存到："}
              </p>
              <code className="block bg-muted p-3 rounded text-sm break-all mb-6">
                {createdPath}
              </code>
              <Button onClick={handleReset} className="w-full">
                {t("create.success.createAnother") || "创建另一个 Skill"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">{t("create.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("create.subtitle")}</p>
      </div>

      {/* Steps Indicator */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-center gap-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                  currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : currentStep > step.id
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {currentStep > step.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className={cn(
                  "ml-2 text-sm hidden sm:inline",
                  currentStep === step.id
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                {t(step.labelKey)}
              </span>
              {index < steps.length - 1 && (
                <div className="mx-4 h-px w-8 bg-border" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {createError && (
            <div className="mb-4 text-sm text-destructive">{createError}</div>
          )}
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5" />
                  {t("create.steps.basic")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    {t("create.fields.name")}
                  </label>
                  <Input
                    placeholder="my-awesome-skill"
                    className="mt-1"
                    value={formData.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("create.fields.nameHint") || "将自动转换为 kebab-case 格式"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {t("create.fields.description")}
                  </label>
                  <Input
                    placeholder="A skill that helps with..."
                    className="mt-1"
                    value={formData.description}
                    onChange={(e) => updateForm("description", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    {t("create.fields.resources") || "资源文件"}
                  </label>

                  <div
                    className={cn(
                      "mt-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      addResourceFiles(e.dataTransfer.files);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addResourceFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />

                    <div className="flex flex-col items-center gap-2 text-center">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <div className="text-sm">
                        {t("create.fields.resourcesDrop") ||
                          "拖拽文件到这里，或点击选择文件"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("create.fields.resourcesHint") ||
                          "文件将安装到 Skill 目录的 resources/ 下"}
                      </div>
                    </div>
                  </div>

                  {resourceFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {resourceFiles.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{item.file.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {item.targetPath} · {formatBytes(item.file.size)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeResourceFile(item.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Instructions */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("create.steps.instructions")}</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full h-64 p-3 rounded-md border bg-background resize-none font-mono text-sm"
                  placeholder="Write detailed instructions for Claude..."
                  value={formData.instructions}
                  onChange={(e) => updateForm("instructions", e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {t("create.fields.instructionsHint") || "告诉 Claude 这个 Skill 应该做什么"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Examples */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("create.steps.examples")}</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full h-64 p-3 rounded-md border bg-background resize-none font-mono text-sm"
                  placeholder="Provide examples (optional)..."
                  value={formData.examples}
                  onChange={(e) => updateForm("examples", e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {t("create.fields.examplesHint") || "可选：提供使用示例帮助 Claude 更好理解"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("create.steps.review")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {t("create.review.preview") || "以下是将生成的 SKILL.md 文件："}
                </p>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm whitespace-pre-wrap overflow-auto max-h-96">
                  {generateSkillMd()}
                </div>

                {resourceFiles.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("create.review.resources") || "将同时安装以下资源文件："}
                    </p>
                    <div className="space-y-2">
                      {resourceFiles.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1 truncate">{item.targetPath}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatBytes(item.file.size)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-6 py-4 flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => s - 1)}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common.back") || "上一步"}
        </Button>

        {currentStep < 4 ? (
          <Button
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={!canProceed()}
          >
            {t("common.next") || "下一步"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            disabled={createSkillMutation.isPending || preparingResources}
          >
            {createSkillMutation.isPending || preparingResources ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {t("common.create")}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
