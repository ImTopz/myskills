import { invoke } from "@tauri-apps/api/core";

// Types matching Rust models
export interface Skill {
  id: string;
  name: string;
  description: string;
  repository: string;
  git_ref?: string;
  path: string;
  category: SkillCategory;
  readme?: string;
  metadata?: SkillMetadata;
  installed_at?: string;
}

export interface SkillMetadata {
  name?: string;
  description?: string;
  author?: string;
  tags?: string[];
}

export interface CreateSkillFile {
  relativePath: string;
  content: number[];
}

export type SkillCategory =
  | "development"
  | "data"
  | "writing"
  | "business"
  | "creative"
  | "productivity"
  | "other";

export interface InstalledSkill {
  id: string;
  name: string;
  description: string;
  path: string;
  installed_at: string;
}

export interface SyncResult {
  success: boolean;
  skills_found: number;
  message: string;
}

export interface Repository {
  id: string;
  url: string;
  name: string;
  is_builtin: boolean;
  base_path?: string;
  git_ref?: string;
  last_synced?: string;
  skill_count?: number;
}

// API functions
export const skillsApi = {
  /**
   * Fetch skills from a GitHub repository
   */
  fetchStoreSkills: async (owner: string, repo: string): Promise<Skill[]> => {
    return invoke<Skill[]>("fetch_store_skills", { owner, repo });
  },

  /**
   * Sync skills from all configured repositories
   */
  syncRepositories: async (): Promise<SyncResult> => {
    return invoke<SyncResult>("sync_repositories");
  },

  /**
   * Force sync - clears cache and re-fetches from GitHub
   */
  forceSyncRepositories: async (): Promise<SyncResult> => {
    return invoke<SyncResult>("force_sync_repositories");
  },

  /**
   * Get cached skills
   */
  getCachedSkills: async (): Promise<Skill[]> => {
    return invoke<Skill[]>("get_cached_skills");
  },

  /**
   * List installed skills
   */
  listInstalledSkills: async (): Promise<InstalledSkill[]> => {
    return invoke<InstalledSkill[]>("list_installed_skills");
  },

  /**
   * Check if a skill is installed
   */
  isSkillInstalled: async (skillName: string): Promise<boolean> => {
    return invoke<boolean>("is_skill_installed", { skillName });
  },

  /**
   * Install a skill
   */
  installSkill: async (skillId: string): Promise<string> => {
    return invoke<string>("install_skill", { skillId });
  },

  /**
   * Uninstall a skill
   */
  uninstallSkill: async (skillName: string): Promise<void> => {
    console.log("[API] uninstallSkill called with:", skillName);
    return invoke<void>("uninstall_skill", { skillName });
  },

  /**
   * Get skills directory path
   */
  getSkillsDirectory: async (): Promise<string> => {
    return invoke<string>("get_skills_directory");
  },

  /**
   * Get skill content (SKILL.md)
   */
  getSkillContent: async (skillName: string): Promise<string> => {
    return invoke<string>("get_skill_content", { skillName });
  },

  // ===== Repository Management =====

  /**
   * List all configured repositories
   */
  listRepositories: async (): Promise<Repository[]> => {
    return invoke<Repository[]>("list_repositories");
  },

  /**
   * Add a custom repository
   */
  addRepository: async (
    owner: string,
    repo: string,
    basePath?: string,
    gitRef?: string
  ): Promise<Repository> => {
    return invoke<Repository>("add_repository", {
      owner,
      repo,
      basePath: basePath ?? null,
      gitRef: gitRef ?? null,
    });
  },

  /**
   * Remove a custom repository
   */
  removeRepository: async (repoId: string): Promise<boolean> => {
    return invoke<boolean>("remove_repository", { repoId });
  },

  /**
   * Create a custom skill
   */
  createCustomSkill: async (
    name: string,
    description: string,
    instructions: string,
    examples?: string,
    resources?: CreateSkillFile[]
  ): Promise<string> => {
    return invoke<string>("create_custom_skill", {
      name,
      description,
      instructions,
      examples: examples || null,
      resources: resources ?? null,
    });
  },
};
