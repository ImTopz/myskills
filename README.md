<div align="center">

# MySkills

**Claude Code Skills 桌面管理器**

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](#)
[![CI](https://github.com/ImTopz/myskills/actions/workflows/ci.yml/badge.svg)](https://github.com/ImTopz/myskills/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ImTopz/myskills?display_name=tag&sort=semver)](https://github.com/ImTopz/myskills/releases)
[![Stars](https://img.shields.io/github/stars/ImTopz/myskills?style=flat)](https://github.com/ImTopz/myskills/stargazers)
[![Built%20with%20Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)

[下载 Releases](https://github.com/ImTopz/myskills/releases) · [提交 Issue](https://github.com/ImTopz/myskills/issues) · [查看 CI](https://github.com/ImTopz/myskills/actions)

</div>

MySkills 用于发现、安装、管理与创建 **Claude Code Skills**。应用会把技能安装到 `~/.claude/skills/`，并提供仓库扫描、安装/卸载、内容查看与自定义 Skill 创建等能力。

## 功能

- **Skill Store**：从配置的 GitHub 仓库扫描 Skills（解析 `SKILL.md` frontmatter / tags）
- **完整安装**：递归下载并安装 Skill 目录（包含 `resources/`、`scripts/` 等文件）
- **Installed 管理**：查看 `SKILL.md`、打开目录、卸载（含操作反馈）
- **创建向导**：生成自定义 Skill，并支持附带资源文件（默认安装到 `resources/`）
- **仓库管理**：支持 `owner/repo`、GitHub `tree/blob` 链接、`raw.githubusercontent.com` 链接（可选指定 `ref` 与子目录）
- **体验**：自动语言检测（中文/英文）、明暗主题

## 下载与安装

### 系统要求

- **macOS（Apple Silicon）**：macOS 10.15+（推荐 11+）
- **Claude Code**：已安装并使用默认 skills 目录（`~/.claude/skills/`）

> 当前 Releases 提供 macOS（Apple Silicon）DMG。Windows/Linux 可自行从源码构建。

### macOS（Apple Silicon）

1. 在 [Releases](https://github.com/ImTopz/myskills/releases) 下载 `.dmg`
2. 打开 DMG，把 `MySkills.app` 拖到 `Applications`
3. 首次启动若被 Gatekeeper 拦截：进入 **系统设置 → 隐私与安全性**，点击 **仍要打开**

## 使用

- **Store**：刷新仓库索引 → 安装/卸载 → 查看详情
- **Installed**：管理本地已安装技能（内容、打开目录、卸载）
- **Create**：创建自定义 Skill（支持资源文件）
- **Settings**：管理仓库、查看目录、切换主题/语言

## 数据目录

- Skills 安装目录：`~/.claude/skills/`
- MySkills 配置：`~/.myskills/config.json`
- MySkills 缓存：`~/.myskills/cache/`（自定义仓库扫描缓存）

## 从源码构建

### 前置条件

- Node.js 18+
- Rust stable（建议使用 `rustup`）
- Tauri 系统依赖：https://tauri.app/start/prerequisites/

### 开发（Tauri Dev）

```bash
npm ci
npm run tauri dev
```

### 打包（DMG，Apple Silicon）

```bash
npm ci
npm run tauri build -- --target aarch64-apple-darwin --bundles dmg
```

产物路径（默认）：
- `src-tauri/target/release/bundle/dmg/`

### 本地对齐 CI（建议）

```bash
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

## 常见问题

### GitHub API 频率限制（Rate Limit）

- 频繁刷新/扫描可能触发限制；可稍后重试
- 如需代理，可配置 `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY`

### “already installed”

- 说明对应目录已存在于 `~/.claude/skills/`
- 可在 Installed 中先卸载，或手动移除目录后重试

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ImTopz/myskills&type=Date)](https://www.star-history.com/#ImTopz/myskills&Date)
