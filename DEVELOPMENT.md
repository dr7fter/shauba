# 🛠️ 刷吧二次开发与 DIY 指南

欢迎来到「刷吧」开源工程！本文档旨在帮助你和你的 AI Agent（如 Cursor / Antigravity / Claude Code / Codex）快速上手、修改界面、增加功能与调校算法。

---

## 🚀 1. 快速启动与环境准备

### 环境要求
- **Node.js**: v18+ (推荐 v20+)
- **Rust**: 1.77.2+ (包含 `cargo`)
- **包管理器**: `npm`

### 一键启动命令
```bash
# 1. 安装前端依赖
npm install

# 2. 启动桌面客户端开发热重载（推荐）
npm run app

# 3. 仅在浏览器中预览界面（轻量快速）
npm run dev
```

---

## 📂 2. 代码架构速览

```
刷吧/
├── src/                          # 前端源码 (React + TypeScript + Vite)
│   ├── components/               # 核心组件库
│   │   ├── MathText.tsx          # LaTeX KaTeX 数学公式渲染器
│   │   ├── GradingReportModal.tsx# 模考复盘战术报告大屏 (Rating 3.0 & 考场150预测)
│   │   └── ...
│   ├── views/                    # 主要页面路由
│   │   ├── PracticeView.tsx      # 刷题演练与纸笔作答主界面
│   │   ├── InsightsView.tsx      # 战术数据大屏 (个人/地图/武器表现)
│   │   ├── InboxView.tsx         # AI 诊断收件箱与草稿批改确认
│   │   └── ReviewView.tsx        # 智能间隔复习与记忆遗忘队列
│   ├── utils.ts                  # 前端战力 Rating 算法、考场 150 分预测映射
│   ├── types.ts                  # 全局 TypeScript 类型定义
│   └── App.css                   # 全局战术 HUD 样式表 (严格遵守 CSS 设计系统)
│
├── src-tauri/                    # 后端内核 (Rust + Tauri v2 + SQLite)
│   ├── src/
│   │   ├── lib.rs                # 数据库初始化、题库增量同步、IPC 通信接口
│   │   └── services/
│   │       └── rating.rs         # HLTV Rating 3.0 复合算法、Donk-tier 爆发、ELO 天梯引擎
│   ├── Cargo.toml                # Rust 依赖配置
│   └── tauri.conf.json           # Tauri 桌面窗口与打包配置
│
├── 题库-大观园/                   # 数一本地题库 (只读源)
│   ├── all_questions_20260813.json # 2000+ 道考研数学一题目数据
│   └── categories.json           # 考点分类树
│
├── AGENTS.md                     # AI Agent 协作批改协议与 Rating 量规
└── AGENT_PROMPT_TEMPLATE.md      # 给 AI Agent 的即插即用指令模板
```

---

## 🎨 3. 前端样式与设计系统规范 (硬约束)

刷吧具有严格的设计系统检查工具，修改 CSS 时请遵循：
1. **严禁硬编码 Hex/RGB 颜色**：必须使用 `var(--*)` 或 `color-mix(...)`（如 `var(--green)`, `var(--ink)`, `var(--surface)`）；
2. **断点白名单**：仅允许 `max-width: 1240px`、`max-width: 960px` 与 `max-height: 720px`；
3. **圆角与阴影**：必须使用系统 Token（如 `var(--r-sm)`, `var(--r-lg)`, `var(--shadow-1)`）。

每次修改样式后，运行以下命令验证：
```bash
npm run check:ui
```

---

## 🧪 4. 自动化测试与打包

```bash
# 运行全量单元测试 (包含 Node 规则测试与 45 项 Rust 算法测试)
npm run test

# 生产环境编译打包 Windows 安装程序 (.exe / .msi)
npm run app:build
```
编译产物将生成在 `src-tauri/target/release/bundle/` 中。
