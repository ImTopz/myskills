use crate::models::{Skill, SkillCategory, SkillMetadata};
use serde::Deserialize;

/// Built-in skill data structure (matches JSON format)
#[derive(Debug, Deserialize)]
struct BuiltinSkillData {
    path: String,
    name: String,
    description: String,
    category: String,
    author: String,
    tags: Vec<String>,
}

/// Built-in skills repository data
#[derive(Debug, Deserialize)]
struct BuiltinRepository {
    repository: String,
    skills: Vec<BuiltinSkillData>,
}

/// Load built-in skills from embedded JSON
pub fn load_builtin_skills() -> Vec<Skill> {
    // Include the JSON file at compile time
    let json_data = include_str!("builtin_skills.json");

    match serde_json::from_str::<BuiltinRepository>(json_data) {
        Ok(repo) => {
            repo.skills
                .into_iter()
                .map(|s| {
                    let category = match s.category.as_str() {
                        "development" => SkillCategory::Development,
                        "data" => SkillCategory::Data,
                        "writing" => SkillCategory::Writing,
                        "business" => SkillCategory::Business,
                        "creative" => SkillCategory::Creative,
                        "productivity" => SkillCategory::Productivity,
                        _ => SkillCategory::Other,
                    };

                    Skill {
                        id: format!("{}/{}", repo.repository, s.path),
                        name: s.name,
                        description: s.description,
                        repository: repo.repository.clone(),
                        git_ref: Some("master".to_string()),
                        path: s.path,
                        category,
                        readme: None, // Will be fetched on demand
                        metadata: Some(SkillMetadata {
                            name: None,
                            description: None,
                            author: Some(s.author),
                            tags: Some(s.tags),
                        }),
                        installed_at: None,
                    }
                })
                .collect()
        }
        Err(e) => {
            eprintln!("[Rust] Failed to load builtin skills: {}", e);
            Vec::new()
        }
    }
}
