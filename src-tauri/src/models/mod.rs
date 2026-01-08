use serde::{Deserialize, Serialize};

/// Skill category
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum SkillCategory {
    Development,
    Data,
    Writing,
    Business,
    Creative,
    Productivity,
    #[default]
    Other,
}

/// Skill metadata from SKILL.md frontmatter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillMetadata {
    pub name: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// Skill data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub repository: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_ref: Option<String>,
    pub path: String,
    pub category: SkillCategory,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub readme: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<SkillMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed_at: Option<String>,
}

/// Installed skill info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledSkill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub installed_at: String,
}

/// Repository configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: String,
    pub url: String,
    pub name: String,
    pub is_builtin: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_ref: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_synced: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skill_count: Option<u32>,
}

/// GitHub API response for repository contents
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct GitHubContent {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub content_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub download_url: Option<String>,
}

/// Sync result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub success: bool,
    pub skills_found: u32,
    pub message: String,
}
