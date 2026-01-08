import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  skillsApi,
  type Skill,
  type InstalledSkill,
  type SyncResult,
  type Repository,
  type CreateSkillFile,
} from "@/lib/api/skills";

// Query keys
export const skillKeys = {
  all: ["skills"] as const,
  store: () => [...skillKeys.all, "store"] as const,
  installed: () => [...skillKeys.all, "installed"] as const,
  detail: (id: string) => [...skillKeys.all, "detail", id] as const,
};

export const repoKeys = {
  all: ["repositories"] as const,
  list: () => [...repoKeys.all, "list"] as const,
};

/**
 * Hook to fetch store skills
 */
export function useStoreSkills() {
  return useQuery<Skill[]>({
    queryKey: skillKeys.store(),
    queryFn: () => skillsApi.getCachedSkills(),
    staleTime: Infinity, // Never consider data stale
    gcTime: Infinity, // Keep in cache forever (formerly cacheTime)
    refetchOnMount: false, // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });
}

/**
 * Hook to sync repositories
 */
export function useSyncRepositories() {
  const queryClient = useQueryClient();

  return useMutation<SyncResult>({
    mutationFn: () => skillsApi.syncRepositories(),
    onSuccess: async () => {
      // Refetch cached skills after successful sync
      // Use refetch instead of invalidate to force immediate update
      await queryClient.refetchQueries({ queryKey: skillKeys.store() });
    },
  });
}

/**
 * Hook to force sync repositories (clears cache)
 */
export function useForceSyncRepositories() {
  const queryClient = useQueryClient();

  return useMutation<SyncResult>({
    mutationFn: () => skillsApi.forceSyncRepositories(),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: skillKeys.store() });
    },
  });
}

/**
 * Hook to get installed skills
 */
export function useInstalledSkills() {
  return useQuery<InstalledSkill[]>({
    queryKey: skillKeys.installed(),
    queryFn: () => skillsApi.listInstalledSkills(),
    staleTime: 1000 * 60, // Consider fresh for 1 minute
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to install a skill
 */
export function useInstallSkill() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, string>({
    mutationFn: async (skillId: string) => {
      console.log("[useInstallSkill] Installing skill:", skillId);
      const result = await skillsApi.installSkill(skillId);
      console.log("[useInstallSkill] Install result:", result);
      return result;
    },
    onSuccess: async () => {
      console.log("[useInstallSkill] Install successful, refreshing lists");
      // Force refetch installed skills immediately
      await queryClient.refetchQueries({ queryKey: skillKeys.installed() });
      // Also refresh store to update install status
      await queryClient.refetchQueries({ queryKey: skillKeys.store() });
    },
    onError: (error) => {
      console.error("[useInstallSkill] Install failed:", error);
    },
  });
}

/**
 * Hook to uninstall a skill
 */
export function useUninstallSkill() {
  const queryClient = useQueryClient();
  type UninstallContext = { previousInstalled?: InstalledSkill[] };

  return useMutation<void, Error, string, UninstallContext>({
    mutationFn: async (skillName: string) => {
      console.log("[useUninstallSkill] Calling API with:", skillName);
      await skillsApi.uninstallSkill(skillName);
      console.log("[useUninstallSkill] API call successful");
    },
    onMutate: async (skillName: string) => {
      await queryClient.cancelQueries({ queryKey: skillKeys.installed() });
      const previousInstalled = queryClient.getQueryData<InstalledSkill[]>(skillKeys.installed());

      queryClient.setQueryData<InstalledSkill[]>(
        skillKeys.installed(),
        (current) => current?.filter((s) => s.id !== skillName) ?? current
      );

      return { previousInstalled };
    },
    onError: (error, _skillName, context) => {
      console.error("[useUninstallSkill] Error:", error);
      if (context?.previousInstalled) {
        queryClient.setQueryData(skillKeys.installed(), context.previousInstalled);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: skillKeys.installed() });
      queryClient.invalidateQueries({ queryKey: skillKeys.store() });
    },
  });
}

/**
 * Hook to get skills directory
 */
export function useSkillsDirectory() {
  return useQuery<string>({
    queryKey: ["skillsDirectory"],
    queryFn: () => skillsApi.getSkillsDirectory(),
    staleTime: Infinity, // Never stale
  });
}

// ===== Repository Management Hooks =====

/**
 * Hook to list repositories
 */
export function useRepositories() {
  return useQuery<Repository[]>({
    queryKey: repoKeys.list(),
    queryFn: () => skillsApi.listRepositories(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to add a repository
 */
export function useAddRepository() {
  const queryClient = useQueryClient();

  return useMutation<
    Repository,
    Error,
    { owner: string; repo: string; basePath?: string; gitRef?: string }
  >({
    mutationFn: ({ owner, repo, basePath, gitRef }) =>
      skillsApi.addRepository(owner, repo, basePath, gitRef),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.list() });
    },
  });
}

/**
 * Hook to remove a repository
 */
export function useRemoveRepository() {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, string>({
    mutationFn: (repoId: string) => skillsApi.removeRepository(repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.list() });
    },
  });
}

/**
 * Hook to create a custom skill
 */
export function useCreateCustomSkill() {
  const queryClient = useQueryClient();

  return useMutation<
    string,
    Error,
    {
      name: string;
      description: string;
      instructions: string;
      examples?: string;
      resources?: CreateSkillFile[];
    }
  >({
    mutationFn: ({ name, description, instructions, examples, resources }) =>
      skillsApi.createCustomSkill(name, description, instructions, examples, resources),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillKeys.installed() });
    },
  });
}
