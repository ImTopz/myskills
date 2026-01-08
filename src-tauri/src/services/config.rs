use crate::models::Repository;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Parse error: {0}")]
    Parse(#[from] serde_json::Error),
    #[error("Config directory not found")]
    ConfigDirNotFound,
}

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub repositories: Vec<Repository>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            repositories: vec![Repository {
                id: "composio-awesome".to_string(),
                url: "ComposioHQ/awesome-claude-skills".to_string(),
                name: "Awesome Claude Skills".to_string(),
                is_builtin: true,
                base_path: None,
                git_ref: None,
                last_synced: None,
                skill_count: None,
            }],
        }
    }
}

pub struct ConfigService;

impl ConfigService {
    fn normalize_base_path(base_path: Option<&str>) -> Option<String> {
        let base_path = base_path?.trim();
        if base_path.is_empty() {
            return None;
        }

        let base_path = base_path.trim_matches('/');
        if base_path.is_empty() {
            return None;
        }

        let base_path = base_path.strip_suffix("/SKILL.md").unwrap_or(base_path);
        let base_path = base_path.strip_suffix("SKILL.md").unwrap_or(base_path);
        let base_path = base_path.trim_matches('/');
        if base_path.is_empty() {
            return None;
        }

        Some(base_path.to_string())
    }

    fn normalize_git_ref(git_ref: Option<&str>) -> Option<String> {
        let git_ref = git_ref?.trim();
        if git_ref.is_empty() {
            return None;
        }
        Some(git_ref.to_string())
    }

    /// Get the config file path
    fn get_config_path() -> Result<PathBuf, ConfigError> {
        let home = dirs::home_dir().ok_or(ConfigError::ConfigDirNotFound)?;
        let config_dir = home.join(".myskills");

        // Create config directory if not exists
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir)?;
        }

        Ok(config_dir.join("config.json"))
    }

    /// Load configuration
    pub fn load() -> Result<AppConfig, ConfigError> {
        let config_path = Self::get_config_path()?;

        if !config_path.exists() {
            let default_config = AppConfig::default();
            Self::save(&default_config)?;
            return Ok(default_config);
        }

        let content = fs::read_to_string(&config_path)?;
        let config: AppConfig = serde_json::from_str(&content)?;
        Ok(config)
    }

    /// Save configuration
    pub fn save(config: &AppConfig) -> Result<(), ConfigError> {
        let config_path = Self::get_config_path()?;
        let content = serde_json::to_string_pretty(config)?;
        fs::write(&config_path, content)?;
        Ok(())
    }

    /// List all repositories
    pub fn list_repositories() -> Result<Vec<Repository>, ConfigError> {
        let config = Self::load()?;
        Ok(config.repositories)
    }

    /// Add a custom repository
    pub fn add_repository(
        owner: &str,
        repo: &str,
        base_path: Option<&str>,
        git_ref: Option<&str>,
    ) -> Result<Repository, ConfigError> {
        let mut config = Self::load()?;

        let repo_url = format!("{}/{}", owner, repo);
        let normalized_base_path = Self::normalize_base_path(base_path);
        let normalized_git_ref = Self::normalize_git_ref(git_ref);

        // Check if already exists
        if let Some(index) = config.repositories.iter().position(|r| r.url == repo_url) {
            let mut updated = false;
            let result = {
                let existing = &mut config.repositories[index];

                if normalized_base_path.is_some() && existing.base_path != normalized_base_path {
                    existing.base_path = normalized_base_path.clone();
                    updated = true;
                }

                if normalized_git_ref.is_some() && existing.git_ref != normalized_git_ref {
                    existing.git_ref = normalized_git_ref.clone();
                    updated = true;
                }

                existing.clone()
            };

            if updated {
                Self::save(&config)?;
            }

            return Ok(result);
        }

        let new_repo = Repository {
            id: format!("{}-{}", owner, repo).to_lowercase(),
            url: repo_url,
            name: format!("{}/{}", owner, repo),
            is_builtin: false,
            base_path: normalized_base_path,
            git_ref: normalized_git_ref,
            last_synced: None,
            skill_count: None,
        };

        config.repositories.push(new_repo.clone());
        Self::save(&config)?;

        Ok(new_repo)
    }

    /// Remove a custom repository (cannot remove builtin)
    pub fn remove_repository(repo_id: &str) -> Result<bool, ConfigError> {
        let mut config = Self::load()?;

        // Find the repository
        if let Some(repo) = config.repositories.iter().find(|r| r.id == repo_id) {
            if repo.is_builtin {
                return Ok(false); // Cannot remove builtin
            }
        }

        let initial_len = config.repositories.len();
        config.repositories.retain(|r| r.id != repo_id);

        if config.repositories.len() < initial_len {
            Self::save(&config)?;
            return Ok(true);
        }

        Ok(false)
    }

    /// Update repository sync info
    pub fn update_repository_sync(repo_id: &str, skill_count: u32) -> Result<(), ConfigError> {
        let mut config = Self::load()?;

        if let Some(repo) = config.repositories.iter_mut().find(|r| r.id == repo_id) {
            repo.last_synced = Some(chrono::Utc::now().to_rfc3339());
            repo.skill_count = Some(skill_count);
            Self::save(&config)?;
        }

        Ok(())
    }
}
