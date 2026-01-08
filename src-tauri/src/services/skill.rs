use crate::models::InstalledSkill;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SkillError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Skill not found: {0}")]
    NotFound(String),
    #[error("Already installed: {0}")]
    AlreadyInstalled(String),
    #[error("Home directory not found")]
    HomeNotFound,
}

pub struct SkillService;

impl SkillService {
    /// Get Claude Code skills directory
    pub fn get_skills_dir() -> Result<PathBuf, SkillError> {
        let home = dirs::home_dir().ok_or(SkillError::HomeNotFound)?;
        let skills_dir = home.join(".claude").join("skills");

        // Create directory if it doesn't exist
        if !skills_dir.exists() {
            fs::create_dir_all(&skills_dir)?;
        }

        Ok(skills_dir)
    }

    /// List all installed skills
    pub fn list_installed() -> Result<Vec<InstalledSkill>, SkillError> {
        let skills_dir = Self::get_skills_dir()?;
        let mut skills = Vec::new();

        if !skills_dir.exists() {
            return Ok(skills);
        }

        for entry in fs::read_dir(&skills_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                let skill_md = path.join("SKILL.md");
                if skill_md.exists() {
                    let name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();

                    // Read SKILL.md for description
                    let description = fs::read_to_string(&skill_md)
                        .ok()
                        .and_then(|content| extract_description(&content))
                        .unwrap_or_else(|| format!("Skill: {}", name));

                    // Get metadata for installed_at
                    let metadata = fs::metadata(&path)?;
                    let installed_at = metadata
                        .created()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs().to_string())
                        .unwrap_or_else(|| "unknown".to_string());

                    skills.push(InstalledSkill {
                        id: name.clone(),
                        name: name.replace('-', " "),
                        description,
                        path: path.to_string_lossy().to_string(),
                        installed_at,
                    });
                }
            }
        }

        Ok(skills)
    }

    /// Check if a skill is installed
    pub fn is_installed(skill_name: &str) -> Result<bool, SkillError> {
        let skills_dir = Self::get_skills_dir()?;
        let skill_path = skills_dir.join(skill_name);
        Ok(skill_path.exists())
    }

    /// Install a skill from content
    pub fn install_skill(
        skill_name: &str,
        files: Vec<(String, Vec<u8>)>,
    ) -> Result<String, SkillError> {
        let skills_dir = Self::get_skills_dir()?;
        let skill_path = skills_dir.join(skill_name);

        if skill_path.exists() {
            return Err(SkillError::AlreadyInstalled(skill_name.to_string()));
        }

        // Create skill directory
        fs::create_dir_all(&skill_path)?;

        // Write files
        for (relative_path, content) in files {
            let relative = Path::new(&relative_path);
            if relative.is_absolute()
                || relative
                    .components()
                    .any(|c| matches!(c, std::path::Component::ParentDir))
            {
                return Err(SkillError::Io(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    format!("Invalid relative path: {}", relative_path),
                )));
            }

            let file_path = skill_path.join(relative);

            // Create parent directories if needed
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent)?;
            }

            fs::write(&file_path, content)?;

            #[cfg(unix)]
            {
                let rel_str = relative_path.replace('\\', "/");
                let is_script = rel_str.split('/').any(|seg| seg == "scripts")
                    || rel_str.ends_with(".sh")
                    || rel_str.ends_with(".command");
                if is_script {
                    let mut perm = fs::metadata(&file_path)?.permissions();
                    perm.set_mode(0o755);
                    fs::set_permissions(&file_path, perm)?;
                }
            }
        }

        Ok(skill_path.to_string_lossy().to_string())
    }

    /// Uninstall a skill
    pub fn uninstall_skill(skill_name: &str) -> Result<(), SkillError> {
        let skills_dir = Self::get_skills_dir()?;
        let skill_path = skills_dir.join(skill_name);

        if !skill_path.exists() {
            return Err(SkillError::NotFound(skill_name.to_string()));
        }

        fs::remove_dir_all(&skill_path)?;
        Ok(())
    }

    /// Read skill content from installed skill
    pub fn get_skill_content(skill_name: &str) -> Result<String, SkillError> {
        let skills_dir = Self::get_skills_dir()?;
        let skill_path = skills_dir.join(skill_name).join("SKILL.md");

        if !skill_path.exists() {
            return Err(SkillError::NotFound(skill_name.to_string()));
        }

        let content = fs::read_to_string(&skill_path)?;
        Ok(content)
    }
}

/// Extract description from SKILL.md content
fn extract_description(content: &str) -> Option<String> {
    // Check frontmatter for description
    if let Some(stripped) = content.strip_prefix("---") {
        if let Some(end) = stripped.find("---") {
            let frontmatter = &stripped[..end];
            for line in frontmatter.lines() {
                if let Some((key, value)) = line.split_once(':') {
                    if key.trim() == "description" {
                        return Some(
                            value
                                .trim()
                                .trim_matches('"')
                                .trim_matches('\'')
                                .to_string(),
                        );
                    }
                }
            }
        }
    }

    // Try to find first paragraph
    for line in content.lines() {
        let line = line.trim();
        if !line.is_empty() && !line.starts_with('#') && !line.starts_with('-') && line.len() > 20 {
            return Some(line.to_string());
        }
    }

    None
}
