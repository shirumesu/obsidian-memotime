<div align="center">

# MemoTime

**Track your active note-editing time with a WakaTime-style dashboard**

[![Release](https://img.shields.io/github/v/release/YOUR_GITHUB/obsidian-memotime?style=flat-square&label=version)](https://github.com/YOUR_GITHUB/obsidian-memotime/releases)
[![Downloads](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&query=%24%5B%22memotime%22%5D.downloads&label=downloads&style=flat-square)](https://obsidian.md/plugins?id=memotime)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

*English | [中文](#中文)*

---

<!-- Screenshot placeholder -->
<!-- ![MemoTime Dashboard](docs/images/dashboard.png) -->

</div>

## Features

- **⏱ Real-time status bar** — Shows active session time, today's total, vault-wide total (configurable)
- **📊 Full dashboard** — WakaTime-style charts: daily activity bars, top notes, folder breakdown, tag distribution, GitHub-style heatmap
- **📁 File explorer labels** — Optionally display time spent next to every note and folder
- **🔄 Multi-device sync** — Store data inside your vault, sync via Obsidian Sync / iCloud / any cloud storage
- **🌐 Bilingual** — Full Chinese (中文) and English support
- **📱 Mobile compatible** — Works on iOS and Android

## How It Works

MemoTime uses a **heartbeat-based tracking** system (like WakaTime): it only counts time when you're actively editing, not just when a file is open. A session ends automatically after a configurable inactivity timeout (default: 2 minutes).

Data is stored as per-day JSON files inside your vault (`.memotime/` by default), automatically synced by whatever sync tool you already use.

## Installation

### From Obsidian Community Plugins

1. Open **Settings → Community Plugins**
2. Search for **MemoTime**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/YOUR_GITHUB/obsidian-memotime/releases)
2. Copy them to `{vault}/.obsidian/plugins/memotime/`
3. Enable the plugin in **Settings → Community Plugins**

### Using BRAT (Beta)

1. Install [BRAT](https://obsidian.md/plugins?id=obsidian42-brat)
2. Run **BRAT: Add a beta plugin** → enter `YOUR_GITHUB/obsidian-memotime`

## Usage

### Status Bar

The status bar (bottom right) shows your active time. Click it to open the dashboard.

Configure which metrics appear in **Settings → MemoTime → Status Bar**.

| Metric | Description |
|--------|-------------|
| Session | Current continuous editing session |
| File | Current file's time today |
| Today | Today's total active time |
| Folder | Current folder's time today |
| Vault | All-time vault total |

### Dashboard

Open via: **Command palette → Open MemoTime Dashboard** or click the status bar.

| Tab | Contents |
|-----|----------|
| Today | Summary cards, top notes, folder pie chart, tag breakdown |
| This Week | 7-day bar chart, top notes |
| History | 30-day chart, activity heatmap (365 days) |

### File Explorer Labels

Enable in **Settings → File Explorer → Show time labels**.
Choose time range: Today / This Week / All Time.

## Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| Activity mode | Typing | Typing: count keystrokes only. Cursor: count any focus activity. |
| Inactivity timeout | 2m | Session ends after this idle period |
| Status bar metrics | Today + Vault | Which metrics to show |
| Sync mode | Off | Off / File sync / API (coming soon) |
| Raw data retention | 30 days | Older data compressed to monthly summaries |

## Data & Privacy

All data is stored locally in your vault (`.memotime/` directory, gitignored by default). No data is sent to any external server. You own your data.

---

<div id="中文"></div>

## 中文说明

**[English](#features) | 中文**

### 功能

- **⏱ 实时状态栏** — 显示当前会话时间、今日总时间、库总时间（可自定义）
- **📊 完整仪表盘** — WakaTime 风格图表：每日活跃时间柱状图、Top 笔记排行、文件夹分布、标签统计、GitHub 风格热力图
- **📁 文件列表标注** — 在每个笔记和文件夹旁显示编辑时间
- **🔄 多端同步** — 数据存储在库内，借助 Obsidian Sync / iCloud 等自动同步
- **🌐 中英双语** — 完整支持中文与英文界面
- **📱 移动端兼容** — 支持 iOS 和 Android

### 工作原理

MemoTime 使用基于**心跳（heartbeat）**的追踪机制（与 WakaTime 相同）：只有在你真正编辑时才计时，而非仅仅打开了文件。超过设定的不活跃阈值（默认 2 分钟）后会话自动结束。

数据以按日期分片的 JSON 文件存储在库内（默认路径 `.memotime/`），通过你现有的同步工具自动同步。

### 安装

**通过 Obsidian 社区插件市场：**
1. 打开**设置 → 第三方插件**
2. 搜索 **MemoTime**
3. 点击**安装**后**启用**

**手动安装：**
1. 从 [Releases](https://github.com/YOUR_GITHUB/obsidian-memotime/releases) 下载 `main.js`、`manifest.json`、`styles.css`
2. 复制到 `{库目录}/.obsidian/plugins/memotime/`
3. 在**设置 → 第三方插件**中启用

### 状态栏配置

点击右下角状态栏可打开仪表盘。在**设置 → MemoTime → 状态栏**中选择显示哪些指标（建议最多 3 项）：会话时间 / 当前文件时间 / 今日时间 / 文件夹时间 / 库总时间。

### 数据安全

所有数据均存储在本地库内，不会上传到任何服务器，数据完全属于你。

---

## Contributing

Issues and PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT © MemoTime Contributors. See [LICENSE](LICENSE).

---

<div align="center">
  <sub>Built with ❤️ for the Obsidian community</sub>
</div>
