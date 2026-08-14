# CharacterOS

CharacterOS 是一个从零实现的、本地优先角色智能体平台。它不依赖 Lobe Vidol，目标是完整展示角色配置、模型调用、持久化、知识检索和长期记忆的工程实现。

## 当前能力

- SQLite 角色数据持久化
- 独立角色背景资料与身份一致性约束
- 角色创建、读取、更新和删除 API
- Ollama 本地模型发现与健康检查
- 基于 Ollama 的流式角色对话
- 独立角色管理与聊天界面

## 本地运行

```bash
pnpm install
pnpm dev
```

默认访问 `http://localhost:3000`。如果 3000 端口已被占用，可以运行：

```bash
pnpm exec next dev --turbo -p 3100
```

然后访问 `http://localhost:3100`。Ollama 默认连接 `http://127.0.0.1:11434`。

需要加载演示角色时，在服务运行期间执行：

```bash
pnpm seed
```

种子脚本可以重复执行，已存在的同名角色会被跳过。

## HTTP API

- `GET/POST /api/characters`：角色列表与创建
- `GET/PATCH/DELETE /api/characters/:id`：角色详情管理
- `GET /api/ollama/models`：本地模型发现与延迟检测
- `POST /api/chat`：注入角色人设并返回纯文本流

## 架构原则

- `src/domain`：业务模型和输入校验，不依赖 UI
- `src/server`：数据库、仓储和外部模型服务
- `src/app/api`：HTTP 边界，只负责解析、验证和映射错误
- `src/app`：产品界面

后续路线：知识文档切片与检索、长期记忆、会话数据库、评测和 Docker 部署。
