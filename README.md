# CharacterOS

本地优先的原创角色陪伴应用。支持私密对话、角色记忆、知识检索、日常语音。

## 项目结构

```text
apps/
  web/           Next.js 网页客户端，仅 UI 与同源 API 转发
  desktop/       Electron 桌面客户端，管理 Web 与 API 两个进程
services/
  api/           独立 Node.js HTTP API、业务服务与 SQLite 仓储
packages/
  contracts/     共享类型、输入校验和角色语音配置
docs/
  requirements/  需求与验收标准
  architecture/  架构决策
  plans/         实施计划
  api/           接口约定
  validation/    实际验证记录
scripts/         开发、构建、初始化和验证工具
```

开发从需求、架构决策和实施计划开始，再以测试和验证记录闭环。详见 [架构](docs/ARCHITECTURE.md)。

## 启动

需要 Node.js 24、pnpm 11.19 和 Ollama。先准备本地模型：

```bash
ollama pull qwen2.5:7b
pnpm install
pnpm dev
```

首次启动后，在另一终端运行 `pnpm seed`，幂等添加苏晚、许知遥、夏栀三位原创角色。网页默认 http://127.0.0.1:3100，API 默认 http://127.0.0.1:4318。

前后端可独立构建、启动：

```bash
pnpm build:api
pnpm start:api
# 另一终端
pnpm build:web
pnpm start
```

网页用 `CHARACTEROS_API_URL` 指定后端地址；API 用 `API_PORT` 指定端口。数据库默认位于根目录 data/characteros.db，也可设置 `CHARACTEROS_DATA_DIR`。Ollama 默认 http://127.0.0.1:11434，可通过 `OLLAMA_BASE_URL` 覆盖。

## 原创角色

- 苏晚：街角书店主理人，温柔倾听与夜间陪伴。
- 许知遥：独立设计师，清醒、务实的生活同行者。
- 夏栀：自由插画师，轻松分享日常的小发现。

角色拥有不同背景、语言习惯、开场白和声线。默认插画随仓库提供，初始化不会覆盖用户已编辑的同名角色。旧版角色仅收起展示，原 ID、聊天与记忆保留，可在首页开启“显示原有角色与历史对话”。旧版第三方角色及形象的权利仍归各自权利人。

## 语音

日常朗读使用 [edge-tts](https://github.com/rany2/edge-tts) 接入微软 Edge 在线语音，无需 API 密钥。需要网络，待朗读的文字会发送给微软，不发送整段会话历史、记忆或角色图片。社区接口没有付费服务的可用性保证。

```powershell
pnpm tts:setup
pnpm tts
```

苏晚使用晓晓，许知遥使用晓伊，夏栀使用晓臻（台湾国语），并保留角色节奏设置。点击“听这段回复”播放，可停止或取消。在线失败显示错误，不自动切回本地语音。旧 Kokoro 实验脚本仍可通过 pnpm tts:local 单独运行，但不再是应用默认语音后端。

角色图为 AI 生成原创场景立绘，存放在 apps/web/public/companions。生成素材不代表真实人物。

## 桌面

```bash
pnpm desktop:dev
pnpm desktop:pack
pnpm desktop:build
```

打包输出位于 dist-desktop。桌面包内置 Node.js，分别启动独立 API 和 Web 服务，使用动态本地端口。用户数据库位于 Electron userData/data；模型文件和个人聊天不会打包进应用。

## 验证

```bash
pnpm check:boundaries
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:api
```

CI 执行同一套检查。HTTP 冒烟测试使用临时数据库，不操作个人聊天。业务包含角色与会话持久化、知识检索、跨会话记忆、需要确认的写入工具和运行轨迹；调试页面位于 /debug。

[接口文档](docs/api/http.md) · [0.2 验证记录](docs/validation/0.2.md)

