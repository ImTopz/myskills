<div align="center">

# MySkills

**Claude Code Skills 管理器**

[![CI](https://github.com/ImTopz/myskills/actions/workflows/ci.yml/badge.svg)](https://github.com/ImTopz/myskills/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ImTopz/myskills?display_name=tag&sort=semver&cacheSeconds=3600)](https://github.com/ImTopz/myskills/releases)
[![Stars](https://img.shields.io/github/stars/ImTopz/myskills?style=flat&cacheSeconds=3600)](https://github.com/ImTopz/myskills/stargazers)
[![Platform](https://img.shields.io/badge/platform-macOS%20Apple%20Silicon-lightgrey.svg)](#系统要求)
[![Built%20with%20Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)

[English](README.md) | 中文 | [日本語](README_JA.md)

[下载 Releases](https://github.com/ImTopz/myskills/releases) · [提交 Issue](https://github.com/ImTopz/myskills/issues) · [查看 Actions](https://github.com/ImTopz/myskills/actions)

</div>

MySkills 是一个轻量的桌面应用，用于发现、安装、管理与创建 **Claude Code Skills**。

应用会把 Skills 安装到 `~/.claude/skills/`，并围绕 GitHub 仓库提供扫描、安装/卸载、内容查看与自定义 Skill 创建的完整流程。

## 功能特性

- **技能商店**：扫描 GitHub 仓库，解析 `SKILL.md` 的元信息
- **完整安装**：递归安装 Skill 目录（包括 `resources/`、`scripts/` 等文件）
- **已安装管理**：查看 `SKILL.md`、在 Finder 中打开目录、卸载
- **创建技能**：向导式创建自定义 Skill（支持附带资源文件，默认安装到 `resources/`）
- **仓库管理**：支持 `owner/repo`，以及 GitHub 的 `tree/blob/raw` 链接（可选 `ref` 与子目录）
- **体验**：自动语言检测（中/英）+ 手动切换、明暗主题

## 下载与安装

### 系统要求

- **macOS**：10.15+（Apple Silicon）
- **Claude Code**：使用默认 Skills 目录 `~/.claude/skills/`

### macOS（Apple Silicon）

1. 前往 [Releases](https://github.com/ImTopz/myskills/releases) 下载最新 `.dmg`
2. 打开 DMG，将 `MySkills.app` 拖到 `Applications`
3. 首次启动可能会被 Gatekeeper 拦截（目前未做公证/签名）：
   - **系统设置 → 隐私与安全性 → 仍要打开**

## 快速开始

- **商店**：刷新 → 安装/卸载 → 查看详情（含 GitHub 跳转）
- **已安装**：打开卡片查看内容 → 卸载 / Finder 打开目录
- **创建**：填写名称/描述/指令 → 可选添加资源文件 → 创建
- **设置**：管理仓库、打开 Skills 目录、切换主题/语言

## 数据目录

- Skills 安装目录：`~/.claude/skills/`
- MySkills 配置：`~/.myskills/config.json`
- MySkills 缓存：`~/.myskills/cache/`（自定义仓库扫描缓存）

## 从源码构建

### 前置条件

- Node.js 18+
- Rust stable（建议用 `rustup`）
- Tauri 系统依赖：https://tauri.app/start/prerequisites/

### 开发模式

```bash
npm ci
npm run tauri dev
```

### 打包 DMG（Apple Silicon）

```bash
npm ci
npm run tauri build -- --target aarch64-apple-darwin --bundles dmg
```

产物默认在 `src-tauri/target/release/bundle/`。

### 本地对齐 CI（建议）

```bash
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

## 常见问题

### GitHub API 频率限制

仓库扫描频繁时可能触发 GitHub API rate limit，可稍后重试。支持代理环境变量：`HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY`。

### “already installed”

说明目标目录已存在于 `~/.claude/skills/`。可在 MySkills 中卸载后重试，或手动删除目录。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ImTopz/myskills&type=Date)](https://www.star-history.com/#ImTopz/myskills&Date)
