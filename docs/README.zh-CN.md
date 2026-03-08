# MemoTime

[English](../README.md) | 中文

MemoTime 是一个 Obsidian 插件，用于统计你在笔记中的有效编辑时长（基于心跳模型，类似 WakaTime）。

> TODO: 当前插件尚未发布到 Obsidian 社区插件市场，涉及市场安装/下载数据的内容暂为占位说明。

## 功能亮点

- 状态栏实时显示：会话、当前文件、今日、当前文件夹、库总时长
- 仪表盘视图：Today / This Week / History
- 文件列表可选显示时长标注
- 中英双语界面
- 本地优先数据存储（`.memotime/`），便于同步

## 兼容性

- Obsidian：`>= 1.0.0`
- 平台：仅桌面端（`isDesktopOnly: true`）

## 安装

### 社区插件市场安装

> TODO: 待社区插件审核通过后再启用本节。

1. 打开 `设置 -> 第三方插件`。
2. 搜索 `MemoTime`。
3. 安装并启用。

### 手动安装

1. 从发布页下载 `main.js`、`manifest.json`、`styles.css`。
2. 复制到 `{库目录}/.obsidian/plugins/memotime/`。
3. 在 Obsidian 第三方插件中启用 `MemoTime`。

### BRAT（Beta）

1. 安装 [BRAT](https://obsidian.md/plugins?id=obsidian42-brat)。
2. 运行 `BRAT: Add a beta plugin`。
3. 输入仓库标识：`<your-github-username>/obsidian-memotime`。

## 使用

- 点击状态栏项目打开仪表盘。
- 或执行命令：`Open MemoTime Dashboard`。
- 在 `设置 -> MemoTime -> 状态栏` 中配置显示指标。

## 设置项

| 设置项 | 默认值 | 说明 |
|---|---|---|
| Activity mode | Typing | Typing 已完整支持；Cursor 模式计划中 |
| Inactivity timeout | 2m | 超过该空闲时间后结束会话 |
| Status bar metrics | Today + Vault | 选择状态栏展示指标 |
| Sync mode | Off | Off / File sync / API（计划中） |
| Raw data retention | 30 days | 旧 raw 数据会压缩为月度聚合 |

## 数据与隐私

所有追踪数据都保存在你的库内 `.memotime/` 目录，不依赖外部服务。

## 发布元信息检查清单

发布前请确认：

- README/BRAT 中的仓库标识已替换为真实值
- `manifest.json`：version、author、authorUrl、fundingUrl
- `versions.json`：包含当前插件版本映射
- Release 附件：`main.js`、`manifest.json`、`styles.css`

## 许可证

MIT。见 [LICENSE](../LICENSE)。
