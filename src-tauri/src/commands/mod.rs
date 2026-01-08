use crate::data;
use crate::models::{InstalledSkill, Repository, Skill, SyncResult};
use crate::services::{CacheService, ConfigService, GitHubService, SkillService};
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub github: GitHubService,
    pub skills_cache: Mutex<Vec<Skill>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            github: GitHubService::new(),
            skills_cache: Mutex::new(Vec::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Fetch skills from a GitHub repository
#[tauri::command]
pub async fn fetch_store_skills(
    state: State<'_, AppState>,
    owner: String,
    repo: String,
) -> Result<Vec<Skill>, String> {
    let skills = state
        .github
        .scan_skills(&owner, &repo, None, None)
        .await
        .map_err(|e| e.to_string())?;

    // Update cache
    let mut cache = state.skills_cache.lock().map_err(|e| e.to_string())?;
    *cache = skills.clone();

    Ok(skills)
}

/// Sync skills from all configured repositories
#[tauri::command]
pub async fn sync_repositories(state: State<'_, AppState>) -> Result<SyncResult, String> {
    println!("[Rust] sync_repositories called");

    // Load configured repositories
    let repositories = ConfigService::list_repositories().map_err(|e| e.to_string())?;
    println!("[Rust] Found {} repositories", repositories.len());

    let mut all_skills = Vec::new();
    let mut total_count = 0u32;
    let mut errors = Vec::new();

    // Default builtin repository URL
    const BUILTIN_REPO: &str = "ComposioHQ/awesome-claude-skills";

    for repo in &repositories {
        // Check if this is the builtin repository
        if repo.url == BUILTIN_REPO && repo.is_builtin {
            // Load from builtin data - no network request needed
            let builtin_skills = data::load_builtin_skills();
            let count = builtin_skills.len() as u32;
            total_count += count;
            all_skills.extend(builtin_skills);
            println!(
                "[Rust] Loaded {} builtin skills from {}",
                count, BUILTIN_REPO
            );

            // Update sync info
            let _ = ConfigService::update_repository_sync(&repo.id, count);
            continue;
        }

        // For custom repositories, check local cache first
        if let Ok(Some(cached_skills)) = CacheService::load_repo_cache(&repo.id) {
            let count = cached_skills.len() as u32;
            total_count += count;
            all_skills.extend(cached_skills);
            println!("[Rust] Loaded {} skills from cache for {}", count, repo.url);

            // Update sync info
            let _ = ConfigService::update_repository_sync(&repo.id, count);
            continue;
        }

        // Parse owner/repo from url
        let parts: Vec<&str> = repo.url.split('/').collect();
        if parts.len() != 2 {
            errors.push(format!("Invalid repository URL: {}", repo.url));
            continue;
        }

        let owner = parts[0];
        let repo_name = parts[1];
        println!("[Rust] Scanning repository: {}/{}", owner, repo_name);

        match state
            .github
            .scan_skills(
                owner,
                repo_name,
                repo.base_path.as_deref(),
                repo.git_ref.as_deref(),
            )
            .await
        {
            Ok(skills) => {
                let count = skills.len() as u32;
                total_count += count;

                // Cache the skills for this repository
                let _ = CacheService::save_repo_cache(&repo.id, &skills);

                all_skills.extend(skills);
                println!("[Rust] Found {} skills in {}/{}", count, owner, repo_name);

                // Update sync info
                let _ = ConfigService::update_repository_sync(&repo.id, count);
            }
            Err(e) => {
                let error_msg = format!("{}: {}", repo.url, e);
                println!("[Rust] Error scanning {}/{}: {}", owner, repo_name, e);
                errors.push(error_msg);
            }
        }
    }

    // Update in-memory cache
    let mut cache = state.skills_cache.lock().map_err(|e| e.to_string())?;
    *cache = all_skills;

    let message = if errors.is_empty() {
        format!(
            "Successfully synced {} skills from {} repositories",
            total_count,
            repositories.len()
        )
    } else {
        format!(
            "Synced {} skills with {} errors: {}",
            total_count,
            errors.len(),
            errors.join("; ")
        )
    };

    println!("[Rust] sync_repositories complete: {}", message);

    Ok(SyncResult {
        success: errors.is_empty(),
        skills_found: total_count,
        message,
    })
}

/// Get cached skills
#[tauri::command]
pub fn get_cached_skills(state: State<'_, AppState>) -> Result<Vec<Skill>, String> {
    let cache = state.skills_cache.lock().map_err(|e| e.to_string())?;
    Ok(cache.clone())
}

/// List installed skills
#[tauri::command]
pub fn list_installed_skills() -> Result<Vec<InstalledSkill>, String> {
    SkillService::list_installed().map_err(|e| e.to_string())
}

/// Check if a skill is installed
#[tauri::command]
pub fn is_skill_installed(skill_name: String) -> Result<bool, String> {
    SkillService::is_installed(&skill_name).map_err(|e| e.to_string())
}

/// Install a skill
#[tauri::command]
pub async fn install_skill(state: State<'_, AppState>, skill_id: String) -> Result<String, String> {
    println!("[Rust] install_skill called with: {}", skill_id);

    // Parse skill_id:
    // - "owner/repo" (SKILL.md at repo root)
    // - "owner/repo/path/to/skill"
    let parts: Vec<&str> = skill_id.split('/').filter(|p| !p.is_empty()).collect();
    if parts.len() < 2 {
        println!("[Rust] install_skill error: Invalid skill ID format");
        return Err("Invalid skill ID format".to_string());
    }

    let owner = parts[0];
    let repo = parts[1];
    let skill_path = if parts.len() > 2 {
        parts[2..].join("/")
    } else {
        String::new()
    };
    let skill_name = if parts.len() > 2 {
        parts[parts.len() - 1]
    } else {
        repo
    };

    println!(
        "[Rust] install_skill parsed: owner={}, repo={}, path={}, name={}",
        owner, repo, skill_path, skill_name
    );

    // Check if already installed
    if SkillService::is_installed(skill_name).map_err(|e| e.to_string())? {
        println!(
            "[Rust] install_skill error: Skill '{}' is already installed",
            skill_name
        );
        return Err(format!("Skill '{}' is already installed", skill_name));
    }

    // Determine repository config (optional base_path/git_ref)
    let repo_url = format!("{}/{}", owner, repo);
    let git_ref = ConfigService::list_repositories()
        .ok()
        .and_then(|repos| repos.into_iter().find(|r| r.url == repo_url))
        .and_then(|r| r.git_ref);

    // Download entire skill directory (SKILL.md + resources/scripts/etc.)
    println!(
        "[Rust] install_skill downloading directory: {}/{}/{}",
        owner, repo, skill_path
    );
    let files = state
        .github
        .download_directory_files(owner, repo, &skill_path, git_ref.as_deref())
        .await
        .map_err(|e| {
            println!("[Rust] install_skill download error: {}", e);
            e.to_string()
        })?;

    println!("[Rust] install_skill files fetched: {}", files.len());

    let result = SkillService::install_skill(skill_name, files).map_err(|e| {
        println!("[Rust] install_skill install error: {}", e);
        e.to_string()
    })?;

    println!("[Rust] install_skill success: {}", result);
    Ok(result)
}

/// Uninstall a skill
#[tauri::command]
pub fn uninstall_skill(skill_name: String) -> Result<(), String> {
    println!("[Rust] uninstall_skill called with: '{}'", skill_name);
    let result = SkillService::uninstall_skill(&skill_name);
    match &result {
        Ok(_) => println!("[Rust] uninstall_skill success for: '{}'", skill_name),
        Err(e) => println!("[Rust] uninstall_skill error for '{}': {}", skill_name, e),
    }
    result.map_err(|e| e.to_string())
}

/// Get skills directory path
#[tauri::command]
pub fn get_skills_directory() -> Result<String, String> {
    SkillService::get_skills_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Get skill content (SKILL.md)
#[tauri::command]
pub fn get_skill_content(skill_name: String) -> Result<String, String> {
    println!("[Rust] get_skill_content called with: {}", skill_name);
    let result = SkillService::get_skill_content(&skill_name);
    match &result {
        Ok(content) => println!(
            "[Rust] get_skill_content success, length: {}",
            content.len()
        ),
        Err(e) => println!("[Rust] get_skill_content error: {}", e),
    }
    result.map_err(|e| e.to_string())
}

// ===== Repository Management Commands =====

/// List all configured repositories
#[tauri::command]
pub fn list_repositories() -> Result<Vec<Repository>, String> {
    ConfigService::list_repositories().map_err(|e| e.to_string())
}

/// Add a custom repository
#[tauri::command]
pub fn add_repository(
    owner: String,
    repo: String,
    base_path: Option<String>,
    git_ref: Option<String>,
) -> Result<Repository, String> {
    let result =
        ConfigService::add_repository(&owner, &repo, base_path.as_deref(), git_ref.as_deref())
            .map_err(|e| e.to_string())?;

    if base_path.is_some() || git_ref.is_some() {
        let _ = CacheService::clear_repo_cache(&result.id);
    }

    Ok(result)
}

/// Remove a custom repository
#[tauri::command]
pub fn remove_repository(repo_id: String) -> Result<bool, String> {
    let removed = ConfigService::remove_repository(&repo_id).map_err(|e| e.to_string())?;
    if removed {
        let _ = CacheService::clear_repo_cache(&repo_id);
    }
    Ok(removed)
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SkillFilePayload {
    relative_path: String,
    content: Vec<u8>,
}

/// Create a custom skill from user input
#[tauri::command]
pub fn create_custom_skill(
    name: String,
    description: String,
    instructions: String,
    examples: Option<String>,
    resources: Option<Vec<SkillFilePayload>>,
) -> Result<String, String> {
    // Sanitize skill name (convert to slug format)
    let skill_name = name
        .to_lowercase()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();

    if skill_name.is_empty() {
        return Err("Invalid skill name".to_string());
    }

    // Check if already exists
    if SkillService::is_installed(&skill_name).map_err(|e| e.to_string())? {
        return Err(format!("Skill '{}' already exists", skill_name));
    }

    // Generate SKILL.md content
    let mut skill_md = format!(
        r#"---
name: {}
description: {}
author: custom
---

# {}

{}

## Instructions

{}
"#,
        skill_name, description, name, description, instructions
    );

    // Add examples section if provided
    if let Some(examples_content) = examples {
        if !examples_content.trim().is_empty() {
            skill_md.push_str(&format!("\n## Examples\n\n{}\n", examples_content));
        }
    }

    // Install the skill
    let mut files = vec![("SKILL.md".to_string(), skill_md.into_bytes())];

    if let Some(resources) = resources {
        for file in resources {
            if file.relative_path.trim().is_empty() {
                continue;
            }
            files.push((file.relative_path, file.content));
        }
    }
    SkillService::install_skill(&skill_name, files).map_err(|e| e.to_string())
}

/// Force sync repositories - clears cache and re-fetches from GitHub
#[tauri::command]
pub async fn force_sync_repositories(state: State<'_, AppState>) -> Result<SyncResult, String> {
    println!("[Rust] force_sync_repositories called");

    // Clear all cache first
    let _ = CacheService::clear_all_cache();
    println!("[Rust] Cache cleared");

    // Load configured repositories
    let repositories = ConfigService::list_repositories().map_err(|e| e.to_string())?;
    println!("[Rust] Found {} repositories", repositories.len());

    let mut all_skills = Vec::new();
    let mut total_count = 0u32;
    let mut errors = Vec::new();

    // Default builtin repository URL
    const BUILTIN_REPO: &str = "ComposioHQ/awesome-claude-skills";

    for repo in &repositories {
        // For builtin repo, still use builtin data (it's updated with app updates)
        if repo.url == BUILTIN_REPO && repo.is_builtin {
            let builtin_skills = data::load_builtin_skills();
            let count = builtin_skills.len() as u32;
            total_count += count;
            all_skills.extend(builtin_skills);
            println!(
                "[Rust] Loaded {} builtin skills from {}",
                count, BUILTIN_REPO
            );
            let _ = ConfigService::update_repository_sync(&repo.id, count);
            continue;
        }

        // Parse owner/repo from url
        let parts: Vec<&str> = repo.url.split('/').collect();
        if parts.len() != 2 {
            errors.push(format!("Invalid repository URL: {}", repo.url));
            continue;
        }

        let owner = parts[0];
        let repo_name = parts[1];
        println!("[Rust] Force fetching from: {}/{}", owner, repo_name);

        match state
            .github
            .scan_skills(
                owner,
                repo_name,
                repo.base_path.as_deref(),
                repo.git_ref.as_deref(),
            )
            .await
        {
            Ok(skills) => {
                let count = skills.len() as u32;
                total_count += count;

                // Save to cache
                let _ = CacheService::save_repo_cache(&repo.id, &skills);

                all_skills.extend(skills);
                println!("[Rust] Found {} skills in {}/{}", count, owner, repo_name);
                let _ = ConfigService::update_repository_sync(&repo.id, count);
            }
            Err(e) => {
                let error_msg = format!("{}: {}", repo.url, e);
                println!("[Rust] Error scanning {}/{}: {}", owner, repo_name, e);
                errors.push(error_msg);
            }
        }
    }

    // Update in-memory cache
    let mut cache = state.skills_cache.lock().map_err(|e| e.to_string())?;
    *cache = all_skills;

    let message = if errors.is_empty() {
        format!(
            "Force synced {} skills from {} repositories",
            total_count,
            repositories.len()
        )
    } else {
        format!(
            "Force synced {} skills with {} errors: {}",
            total_count,
            errors.len(),
            errors.join("; ")
        )
    };

    println!("[Rust] force_sync_repositories complete: {}", message);

    Ok(SyncResult {
        success: errors.is_empty(),
        skills_found: total_count,
        message,
    })
}
