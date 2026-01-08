use crate::models::Skill;
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CacheError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Parse error: {0}")]
    Parse(#[from] serde_json::Error),
    #[error("Cache directory not found")]
    CacheDirNotFound,
}

pub struct CacheService;

impl CacheService {
    /// Get the cache directory path
    fn get_cache_dir() -> Result<PathBuf, CacheError> {
        let home = dirs::home_dir().ok_or(CacheError::CacheDirNotFound)?;
        let cache_dir = home.join(".myskills").join("cache");

        // Create directory if not exists
        if !cache_dir.exists() {
            fs::create_dir_all(&cache_dir)?;
        }

        Ok(cache_dir)
    }

    /// Get the cache file path for a repository
    fn get_repo_cache_path(repo_id: &str) -> Result<PathBuf, CacheError> {
        let cache_dir = Self::get_cache_dir()?;
        // Sanitize repo_id for filename
        let safe_id = repo_id.replace(['/', '\\'], "_");
        Ok(cache_dir.join(format!("{}.json", safe_id)))
    }

    /// Load cached skills for a repository
    pub fn load_repo_cache(repo_id: &str) -> Result<Option<Vec<Skill>>, CacheError> {
        let cache_path = Self::get_repo_cache_path(repo_id)?;

        if !cache_path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&cache_path)?;
        let skills: Vec<Skill> = serde_json::from_str(&content)?;
        Ok(Some(skills))
    }

    /// Save skills cache for a repository
    pub fn save_repo_cache(repo_id: &str, skills: &[Skill]) -> Result<(), CacheError> {
        let cache_path = Self::get_repo_cache_path(repo_id)?;
        let content = serde_json::to_string_pretty(skills)?;
        fs::write(&cache_path, content)?;
        Ok(())
    }

    /// Clear cache for a specific repository
    pub fn clear_repo_cache(repo_id: &str) -> Result<(), CacheError> {
        let cache_path = Self::get_repo_cache_path(repo_id)?;
        if cache_path.exists() {
            fs::remove_file(&cache_path)?;
        }
        Ok(())
    }

    /// Clear all cache
    pub fn clear_all_cache() -> Result<(), CacheError> {
        let cache_dir = Self::get_cache_dir()?;
        if cache_dir.exists() {
            for entry in fs::read_dir(&cache_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() && path.extension().is_some_and(|ext| ext == "json") {
                    fs::remove_file(&path)?;
                }
            }
        }
        Ok(())
    }
}
