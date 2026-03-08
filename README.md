# MemoTime

Track active note-editing time in Obsidian with a WakaTime-style dashboard.

[![Downloads](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&query=%24%5B%22memotime%22%5D.downloads&label=downloads&style=flat-square)](https://obsidian.md/plugins?id=memotime)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

English | [中文](docs/README.zh-CN.md)

> TODO: This plugin is not yet published to the Obsidian Community Plugins marketplace. Treat marketplace/download links as placeholders until release.

## Highlights

- Real-time status bar metrics (session, file, day, folder, vault)
- Dashboard with Today / Week / History views
- Optional file explorer time badges
- Bilingual UI (English + 中文)
- Local-first storage (`.memotime/`) with sync-friendly files

## Compatibility

- Obsidian: `>= 1.0.0`
- Platform: desktop only (`isDesktopOnly: true`)

## Installation

### Community Plugins

> TODO: Enable this section after community marketplace approval.

1. Open `Settings -> Community Plugins`.
2. Search for `MemoTime`.
3. Install and enable.

### Manual Install

1. Download `main.js`, `manifest.json`, `styles.css` from your release page.
2. Copy them to `{vault}/.obsidian/plugins/memotime/`.
3. Enable `MemoTime` in Community Plugins.

### BRAT (Beta)

1. Install [BRAT](https://obsidian.md/plugins?id=obsidian42-brat).
2. Run `BRAT: Add a beta plugin`.
3. Enter your repository slug: `<your-github-username>/obsidian-memotime`.

## Usage

- Click the status bar item to open the dashboard.
- Or run command: `Open MemoTime Dashboard`.
- Configure metrics in `Settings -> MemoTime -> Status Bar`.

## Settings

| Setting | Default | Description |
|---|---|---|
| Activity mode | Typing | Typing is fully supported; cursor mode is planned |
| Inactivity timeout | 2m | Session ends after this idle period |
| Status bar metrics | Today + Vault | Choose visible metrics |
| Sync mode | Off | Off / File sync / API (planned) |
| Raw data retention | 30 days | Older raw data is compressed to monthly aggregates |

## Data & Privacy

All tracking data stays in your vault under `.memotime/`. No external service is required.

## Release Metadata Checklist

Before publishing, replace placeholders and verify:

- Repository slug in README/BRAT instructions
- `manifest.json`: version, author, authorUrl, fundingUrl
- `versions.json`: includes the current plugin version mapping
- Release assets: `main.js`, `manifest.json`, `styles.css`

## License

MIT. See [LICENSE](LICENSE).
