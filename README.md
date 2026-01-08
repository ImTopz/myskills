<div align="center">

# MySkills

**Claude Code Skills Manager**

[![CI](https://github.com/ImTopz/myskills/actions/workflows/ci.yml/badge.svg)](https://github.com/ImTopz/myskills/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ImTopz/myskills?display_name=tag&sort=semver&cacheSeconds=3600)](https://github.com/ImTopz/myskills/releases)
[![Stars](https://img.shields.io/github/stars/ImTopz/myskills?style=flat&cacheSeconds=3600)](https://github.com/ImTopz/myskills/stargazers)
[![Platform](https://img.shields.io/badge/platform-macOS%20Apple%20Silicon-lightgrey.svg)](#system-requirements)
[![Built%20with%20Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)

English | [中文](README_ZH.md) | [日本語](README_JA.md)

[Releases](https://github.com/ImTopz/myskills/releases) · [Issues](https://github.com/ImTopz/myskills/issues) · [Actions](https://github.com/ImTopz/myskills/actions)

</div>

MySkills is a lightweight desktop app for discovering, installing, and managing **Claude Code Skills**.

It installs skills into `~/.claude/skills/` and provides a simple workflow around GitHub-based skill repositories (scan, install/uninstall, view content, and create your own skills).

## Features

- **Skill Store**: scan GitHub repositories and read metadata from `SKILL.md`
- **Full install**: installs the whole skill directory (including `resources/`, `scripts/`, etc.)
- **Installed management**: preview `SKILL.md`, reveal in Finder, uninstall
- **Create skill**: wizard to generate a custom skill (with optional resource files installed under `resources/`)
- **Repository management**: add `owner/repo` or GitHub URLs (`tree/blob/raw`), with optional `ref` and subpath
- **UX**: automatic language detection (ZH/EN) + manual toggle, light/dark theme

## Download & Install

### System requirements

- **macOS**: 10.15+ (Apple Silicon)
- **Claude Code**: uses the default skills directory `~/.claude/skills/`

### macOS (Apple Silicon)

1. Download the latest `.dmg` from [Releases](https://github.com/ImTopz/myskills/releases)
2. Open the DMG and drag `MySkills.app` into `Applications`
3. First launch may be blocked by Gatekeeper (not notarized yet):
   - **System Settings → Privacy & Security → Open Anyway**

## Quick Start

- **Store**: refresh → install/uninstall → open details (and GitHub link)
- **Installed**: open a skill card → preview content → uninstall or reveal in Finder
- **Create**: fill in name/description/instructions → optionally attach resource files → create
- **Settings**: manage repositories, open skills directory, theme/language

## Data locations

- Skills directory: `~/.claude/skills/`
- App config: `~/.myskills/config.json`
- Cache: `~/.myskills/cache/` (scan results for custom repositories)

## Build from source

### Prerequisites

- Node.js 18+
- Rust stable (via `rustup`)
- Tauri system dependencies: https://tauri.app/start/prerequisites/

### Dev

```bash
npm ci
npm run tauri dev
```

### Build (DMG, Apple Silicon)

```bash
npm ci
npm run tauri build -- --target aarch64-apple-darwin --bundles dmg
```

Artifacts are generated under `src-tauri/target/release/bundle/`.

### CI parity

```bash
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

## Troubleshooting

### GitHub API rate limit

Frequent scans may hit GitHub API rate limits. You can wait and retry. Proxy is supported via `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY`.

### “already installed”

The target directory already exists under `~/.claude/skills/`. Uninstall it in MySkills or remove the directory manually.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ImTopz/myskills&type=Date)](https://www.star-history.com/#ImTopz/myskills&Date)
