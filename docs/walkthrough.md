# 刷吧 v0.9.5 全面升级与模块化解耦完成报告

## 📌 版本概览

- **版本号**：v0.9.5（正式版）
- **发布产物**：
  - Windows 安装包：[`releases/v0.9.5/刷吧_0.9.5_x64-setup.exe`](file:///e:/刷吧/releases/v0.9.5/刷吧_0.9.5_x64-setup.exe)
  - MSI 独立安装程序：[`releases/v0.9.5/刷吧_0.9.5_x64_zh-CN.msi`](file:///e:/刷吧/releases/v0.9.5/刷吧_0.9.5_x64_zh-CN.msi)
- **工程质量指标**：
  - 前端编译构建：`npm run build` ⚡ 100% 通过（0 错误，0 警告）
  - 全量自动化测试：`npm test` ⚡ 5 项 Node 测试 + 35 项 Rust 单元测试全部通过（通过率 100%）

---

## 🛠️ 核心架构解耦与重构成果

### 1. 前端单体大文件（5000+ 行）彻底解耦
原单体 `src/App.tsx` 已彻底拆解为路由分发与顶层 Shell（行数精简至 ~500 行），各功能模块清晰独立：

| 模块类别 | 独立文件路径 | 功能职责与特性 |
| :--- | :--- | :--- |
| **今日刷题** | [`src/views/TodayView.tsx`](file:///e:/刷吧/src/views/TodayView.tsx) | 连续刷题、即时自评面板、断点归因、闪击战、压力模拟、成就卡片 |
| **题库检索** | [`src/views/LibraryView.tsx`](file:///e:/刷吧/src/views/LibraryView.tsx) | 题库全量检索、多级章节树、多考点自由勾选组合专项攻坚 |
| **复盘地图** | [`src/views/ReviewView.tsx`](file:///e:/刷吧/src/views/ReviewView.tsx) | 复习债务地图、双模热力图、考点子板块下钻、错题轨迹 |
| **全景地图** | [`src/views/MasteryMapView.tsx`](file:///e:/刷吧/src/views/MasteryMapView.tsx) | 掌握度矩形树图（Treemap）/章节双模、全景档案弹窗 |
| **数据洞察** | [`src/views/InsightsView.tsx`](file:///e:/刷吧/src/views/InsightsView.tsx) | 14 天趋势、错因分布、高压模考历程档案、A4 打印周报 |
| **批改收件** | [`src/views/InboxView.tsx`](file:///e:/刷吧/src/views/InboxView.tsx) | 单题与整组 Codex 批改回传确认、AI 推荐题组承接 |
| **历史回顾** | [`src/views/HistoryView.tsx`](file:///e:/刷吧/src/views/HistoryView.tsx) | 过去每日作答卡片、AI 点评与变式入口 |
| **系统设置** | [`src/views/SettingsView.tsx`](file:///e:/刷吧/src/views/SettingsView.tsx) | 学习目标、SRS 间隔、主题字号、备份与恢复 |

### 2. 核心组件独立封装
- [`src/components/SubBranchArchiveModal.tsx`](file:///e:/刷吧/src/components/SubBranchArchiveModal.tsx)：考点全景做题档案大弹窗（掌握度驾驶舱、做题流、变式攻坚）
- [`src/components/GradingReportModal.tsx`](file:///e:/刷吧/src/components/GradingReportModal.tsx)：压力模拟学习报告独立大浮层
- [`src/components/QuestionDetailModal.tsx`](file:///e:/刷吧/src/components/QuestionDetailModal.tsx)：单题详情解析弹窗
- [`src/components/QueueDrawer.tsx`](file:///e:/刷吧/src/components/QueueDrawer.tsx)：自定义训练队列抽屉
- [`src/components/BlitzExamModal.tsx`](file:///e:/刷吧/src/components/BlitzExamModal.tsx)：15 分钟真题闪击战结算弹窗
- [`src/components/FormulaDrawer.tsx`](file:///e:/刷吧/src/components/FormulaDrawer.tsx)：考点公式速查侧边抽屉
- [`src/components/EmptyState.tsx`](file:///e:/刷吧/src/components/EmptyState.tsx)、[`src/components/Pagination.tsx`](file:///e:/刷吧/src/components/Pagination.tsx)、[`src/components/QuestionImages.tsx`](file:///e:/刷吧/src/components/QuestionImages.tsx)

---

## 🚀 新增特色功能（M2 & M3）

1. **全键盘极速刷题流**：
   - 选项选择：按 <kbd>A</kbd> / <kbd>B</kbd> / <kbd>C</kbd> / <kbd>D</kbd> 键直接切换/多选客观题选项；
   - 查看与继续：按 <kbd>␣ 空格</kbd> 或 <kbd>↵ 回车</kbd> 一键翻转看答案、再次按下记录并进入下一题；
   - 流畅度评定：按 <kbd>1</kbd> ~ <kbd>4</kbd> 极速自评；
   - 快捷辅助：按 <kbd>S</kbd> 跳过题目移至队尾，按 <kbd>V</kbd> 立即调出 3 道同考点变式题；
   - 全局调度：<kbd>Ctrl+K</kbd> 呼出命令菜单，<kbd>Alt+F</kbd> 展开公式抽屉，<kbd>Alt+Z</kbd> 切换沉浸专注模式。

2. **高压模考历程档案**：
   - 「进展」视图新增「高压模考档案」选项卡，完整记录每一次纸笔模考的开始时间、完成题数、总用时、各题分步用时与出分状态；
   - 已完成整组批改的模考支持一键调出 AI 深度学习报告。

3. **A4 标准排版学习周报打印与 PDF 导出**：
   - 周报生成后新增「打印 / 导出 A4 周报」按钮；
   - 内置 `@media print` 专业排版样式表，隐藏多余 UI 与导航栏，生成纯净利落的纸质错题/周报 PDF。

---

## ✅ 验证结果

- `npm run build`：**通过**（Vite 构建 2225 模块，耗时 0.6s）
- `node --test tests/evidence_model.test.js`：**5/5 通过**
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`：**35/35 单元测试全部通过**
- `tauri build`：**打包完成**，生成 `刷吧_0.9.5_x64-setup.exe` 与 `刷吧_0.9.5_x64_zh-CN.msi`。
