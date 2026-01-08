use crate::models::{GitHubContent, Skill, SkillCategory, SkillMetadata};
use base64::{engine::general_purpose::STANDARD, Engine};
use regex::Regex;
use reqwest::{Client, Proxy};
use std::collections::{HashSet, VecDeque};
use std::time::Duration;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitHubError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Rate limited")]
    RateLimited,
    #[error("Not found: {0}")]
    NotFound(String),
}

pub struct GitHubService {
    client: Client,
}

impl GitHubService {
    pub fn new() -> Self {
        // Build client with proxy support from environment variables
        // Reqwest automatically reads from: HTTPS_PROXY, HTTP_PROXY, ALL_PROXY, NO_PROXY
        let mut builder = Client::builder()
            // Use system's native TLS (better proxy integration on macOS)
            .use_native_tls()
            // Connection timeout
            .connect_timeout(Duration::from_secs(15))
            // Request timeout
            .timeout(Duration::from_secs(60));

        // Try to configure proxy from environment variables
        // Supports: http://host:port, socks5://host:port, socks5h://host:port
        if let Some(proxy_url) = Self::get_proxy_from_env() {
            if let Ok(proxy) = Proxy::all(&proxy_url) {
                builder = builder.proxy(proxy);
            }
        }

        let client = builder.build().unwrap_or_else(|_| Client::new());

        Self { client }
    }

    /// Get proxy URL from environment variables
    /// Supports HTTPS_PROXY, HTTP_PROXY, ALL_PROXY (case-insensitive)
    fn get_proxy_from_env() -> Option<String> {
        std::env::var("HTTPS_PROXY")
            .ok()
            .or_else(|| std::env::var("https_proxy").ok())
            .or_else(|| std::env::var("HTTP_PROXY").ok())
            .or_else(|| std::env::var("http_proxy").ok())
            .or_else(|| std::env::var("ALL_PROXY").ok())
            .or_else(|| std::env::var("all_proxy").ok())
    }

    /// Make HTTP request with retry logic
    async fn request_with_retry(
        &self,
        url: &str,
        max_retries: u32,
    ) -> Result<reqwest::Response, GitHubError> {
        let mut last_error = None;

        for attempt in 0..max_retries {
            if attempt > 0 {
                // Wait before retry (exponential backoff)
                tokio::time::sleep(Duration::from_millis(500 * (1 << attempt))).await;
            }

            match self
                .client
                .get(url)
                .header("User-Agent", "MySkills-App")
                .header("Accept", "application/vnd.github.v3+json")
                .send()
                .await
            {
                Ok(response) => return Ok(response),
                Err(e) => {
                    last_error = Some(e);
                    continue;
                }
            }
        }

        Err(GitHubError::Network(last_error.unwrap()))
    }

    async fn request_bytes_with_retry(
        &self,
        url: &str,
        max_retries: u32,
    ) -> Result<Vec<u8>, GitHubError> {
        let mut last_error = None;

        for attempt in 0..max_retries {
            if attempt > 0 {
                tokio::time::sleep(Duration::from_millis(500 * (1 << attempt))).await;
            }

            match self
                .client
                .get(url)
                .header("User-Agent", "MySkills-App")
                .send()
                .await
            {
                Ok(response) => {
                    if response.status() == 403 {
                        return Err(GitHubError::RateLimited);
                    }
                    if response.status() == 404 {
                        return Err(GitHubError::NotFound(url.to_string()));
                    }
                    if !response.status().is_success() {
                        return Err(GitHubError::Parse(format!(
                            "Unexpected status {} for {}",
                            response.status(),
                            url
                        )));
                    }
                    let bytes = response.bytes().await?;
                    return Ok(bytes.to_vec());
                }
                Err(e) => {
                    last_error = Some(e);
                    continue;
                }
            }
        }

        Err(GitHubError::Network(last_error.unwrap()))
    }

    /// Fetch repository contents from GitHub API
    pub async fn fetch_contents(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        git_ref: Option<&str>,
    ) -> Result<Vec<GitHubContent>, GitHubError> {
        let mut url = reqwest::Url::parse(&format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            owner, repo, path
        ))
        .map_err(|e| GitHubError::Parse(e.to_string()))?;

        if let Some(git_ref) = git_ref {
            url.query_pairs_mut().append_pair("ref", git_ref);
        }

        let response = self.request_with_retry(url.as_str(), 3).await?;

        if response.status() == 403 {
            return Err(GitHubError::RateLimited);
        }

        if response.status() == 404 {
            return Err(GitHubError::NotFound(path.to_string()));
        }

        let contents: Vec<GitHubContent> = response.json().await?;
        Ok(contents)
    }

    /// Fetch file content from GitHub
    pub async fn fetch_file(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        git_ref: Option<&str>,
    ) -> Result<String, GitHubError> {
        let mut url = reqwest::Url::parse(&format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            owner, repo, path
        ))
        .map_err(|e| GitHubError::Parse(e.to_string()))?;

        if let Some(git_ref) = git_ref {
            url.query_pairs_mut().append_pair("ref", git_ref);
        }

        let response = self.request_with_retry(url.as_str(), 3).await?;

        if response.status() == 404 {
            return Err(GitHubError::NotFound(path.to_string()));
        }

        let content: GitHubContent = response.json().await?;

        if let Some(encoded) = content.content {
            let decoded = STANDARD
                .decode(encoded.replace('\n', ""))
                .map_err(|e| GitHubError::Parse(e.to_string()))?;
            String::from_utf8(decoded).map_err(|e| GitHubError::Parse(e.to_string()))
        } else {
            Err(GitHubError::Parse("No content found".to_string()))
        }
    }

    /// Fetch file content from GitHub (raw bytes)
    pub async fn fetch_file_bytes(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        git_ref: Option<&str>,
    ) -> Result<Vec<u8>, GitHubError> {
        let mut url = reqwest::Url::parse(&format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            owner, repo, path
        ))
        .map_err(|e| GitHubError::Parse(e.to_string()))?;

        if let Some(git_ref) = git_ref {
            url.query_pairs_mut().append_pair("ref", git_ref);
        }

        let response = self.request_with_retry(url.as_str(), 3).await?;

        if response.status() == 404 {
            return Err(GitHubError::NotFound(path.to_string()));
        }

        let content: GitHubContent = response.json().await?;

        if let Some(encoded) = content.content {
            STANDARD
                .decode(encoded.replace('\n', ""))
                .map_err(|e| GitHubError::Parse(e.to_string()))
        } else if let Some(download_url) = content.download_url {
            self.request_bytes_with_retry(&download_url, 3).await
        } else {
            Err(GitHubError::Parse("No content found".to_string()))
        }
    }

    pub async fn download_directory_files(
        &self,
        owner: &str,
        repo: &str,
        dir_path: &str,
        git_ref: Option<&str>,
    ) -> Result<Vec<(String, Vec<u8>)>, GitHubError> {
        let base_dir = dir_path.trim_matches('/').to_string();
        let mut files = Vec::new();
        let mut queue = VecDeque::from([base_dir.clone()]);

        while let Some(current_dir) = queue.pop_front() {
            let contents = self
                .fetch_contents(owner, repo, &current_dir, git_ref)
                .await?;

            for item in contents {
                match item.content_type.as_str() {
                    "file" => {
                        let bytes = if let Some(download_url) = item.download_url {
                            self.request_bytes_with_retry(&download_url, 3).await?
                        } else {
                            self.fetch_file_bytes(owner, repo, &item.path, git_ref)
                                .await?
                        };

                        let relative = item
                            .path
                            .strip_prefix(&base_dir)
                            .unwrap_or(item.path.as_str())
                            .trim_start_matches('/')
                            .to_string();
                        files.push((relative, bytes));
                    }
                    "dir" => {
                        queue.push_back(item.path);
                    }
                    _ => {}
                }
            }
        }

        Ok(files)
    }

    /// Scan repository for skills
    pub async fn scan_skills(
        &self,
        owner: &str,
        repo: &str,
        base_path: Option<&str>,
        git_ref: Option<&str>,
    ) -> Result<Vec<Skill>, GitHubError> {
        let mut skills = Vec::new();

        let base_path = base_path.unwrap_or("").trim_matches('/').to_string();
        let mut queue = VecDeque::from([(base_path, 0u32)]);
        let mut visited = HashSet::<String>::new();

        const MAX_DEPTH: u32 = 3;

        while let Some((dir_path, depth)) = queue.pop_front() {
            if !visited.insert(dir_path.clone()) {
                continue;
            }

            let contents = self.fetch_contents(owner, repo, &dir_path, git_ref).await?;

            let has_skill_md = contents.iter().any(|item| {
                item.content_type == "file" && item.name.eq_ignore_ascii_case("SKILL.md")
            });

            if has_skill_md {
                skills.push(
                    self.parse_skill_directory(owner, repo, &dir_path, git_ref)
                        .await?,
                );
                continue;
            }

            if depth >= MAX_DEPTH {
                continue;
            }

            for item in contents {
                if item.content_type != "dir" {
                    continue;
                }

                let subdir_path = if dir_path.is_empty() {
                    item.name
                } else {
                    format!("{}/{}", dir_path, item.name)
                };
                queue.push_back((subdir_path, depth + 1));
            }
        }

        Ok(skills)
    }

    /// Parse a skill directory
    async fn parse_skill_directory(
        &self,
        owner: &str,
        repo: &str,
        dir_path: &str,
        git_ref: Option<&str>,
    ) -> Result<Skill, GitHubError> {
        let skill_md_path = if dir_path.is_empty() {
            "SKILL.md".to_string()
        } else {
            format!("{}/SKILL.md", dir_path)
        };

        let content = self
            .fetch_file(owner, repo, &skill_md_path, git_ref)
            .await?;

        // Parse frontmatter and content
        let (metadata, description) = parse_skill_md(&content);

        let folder_name = if dir_path.is_empty() {
            repo.to_string()
        } else {
            dir_path.rsplit('/').next().unwrap_or("skill").to_string()
        };

        let name = metadata
            .name
            .clone()
            .unwrap_or_else(|| folder_name.replace('-', " "));

        let desc = metadata
            .description
            .clone()
            .or(description)
            .unwrap_or_else(|| format!("A skill from {}", folder_name));

        let category = categorize_skill(&name, &desc, &metadata.tags);

        let id = if dir_path.is_empty() {
            format!("{}/{}", owner, repo)
        } else {
            format!("{}/{}/{}", owner, repo, dir_path)
        };

        Ok(Skill {
            id,
            name,
            description: desc,
            repository: format!("{}/{}", owner, repo),
            git_ref: git_ref.map(|s| s.to_string()),
            path: folder_name,
            category,
            readme: Some(content),
            metadata: Some(metadata),
            installed_at: None,
        })
    }
}

/// Parse SKILL.md content
fn parse_skill_md(content: &str) -> (SkillMetadata, Option<String>) {
    let mut metadata = SkillMetadata::default();
    let mut description = None;
    let mut tags: Vec<String> = Vec::new();

    // Check for frontmatter
    if let Some(stripped) = content.strip_prefix("---") {
        if let Some(end) = stripped.find("---") {
            let frontmatter = &stripped[..end];

            // Parse simple YAML frontmatter
            let mut in_tags_list = false;
            for line in frontmatter.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }

                // Handle YAML list under `tags:`
                if in_tags_list {
                    if line.starts_with('-') {
                        let tag = line
                            .trim_start_matches('-')
                            .trim()
                            .trim_matches('"')
                            .trim_matches('\'');
                        if !tag.is_empty() {
                            tags.push(tag.to_string());
                        }
                        continue;
                    }

                    // End of tags list when encountering a new key or non-list content
                    if !line.contains(':') {
                        continue;
                    }
                    in_tags_list = false;
                }

                if let Some((key, value)) = line.split_once(':') {
                    let key = key.trim();
                    let value = value.trim().trim_matches('"').trim_matches('\'');
                    match key {
                        "name" => metadata.name = Some(value.to_string()),
                        "description" => metadata.description = Some(value.to_string()),
                        "author" => metadata.author = Some(value.to_string()),
                        "tags" => {
                            if value.is_empty() {
                                in_tags_list = true;
                            } else {
                                tags.extend(parse_inline_tags(value));
                            }
                        }
                        _ => {}
                    }
                }
            }

            if !tags.is_empty() {
                metadata.tags = Some(tags);
            }

            // Get content after frontmatter
            let body = &stripped[end + 3..];
            description = extract_first_paragraph(body);
        }
    } else {
        description = extract_first_paragraph(content);
    }

    (metadata, description)
}

fn parse_inline_tags(value: &str) -> Vec<String> {
    let mut v = value.trim();
    if v.starts_with('[') && v.ends_with(']') && v.len() >= 2 {
        v = &v[1..v.len() - 1];
    }

    v.split(',')
        .map(|s| s.trim().trim_matches('"').trim_matches('\''))
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect()
}

/// Extract first meaningful paragraph from markdown
fn extract_first_paragraph(content: &str) -> Option<String> {
    let re = Regex::new(r"(?m)^[^#\n].*$").unwrap();

    for cap in re.find_iter(content) {
        let text = cap.as_str().trim();
        if !text.is_empty() && text.len() > 20 {
            return Some(text.to_string());
        }
    }
    None
}

/// Categorize skill based on name, description, and tags
fn categorize_skill(name: &str, desc: &str, tags: &Option<Vec<String>>) -> SkillCategory {
    let text = format!("{} {} {:?}", name, desc, tags).to_lowercase();

    if text.contains("code")
        || text.contains("develop")
        || text.contains("test")
        || text.contains("git")
    {
        SkillCategory::Development
    } else if text.contains("data")
        || text.contains("csv")
        || text.contains("sql")
        || text.contains("analy")
    {
        SkillCategory::Data
    } else if text.contains("writ")
        || text.contains("article")
        || text.contains("content")
        || text.contains("doc")
    {
        SkillCategory::Writing
    } else if text.contains("business")
        || text.contains("market")
        || text.contains("lead")
        || text.contains("sales")
    {
        SkillCategory::Business
    } else if text.contains("image")
        || text.contains("video")
        || text.contains("creative")
        || text.contains("design")
    {
        SkillCategory::Creative
    } else if text.contains("productiv")
        || text.contains("organiz")
        || text.contains("file")
        || text.contains("automat")
    {
        SkillCategory::Productivity
    } else {
        SkillCategory::Other
    }
}

impl Default for GitHubService {
    fn default() -> Self {
        Self::new()
    }
}
