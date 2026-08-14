# CharacterOS

CharacterOS 是一个从零实现、本地优先的角色智能体平台，不依赖 Lobe Vidol。它包含角色配置、知识检索、会话持久化、长期记忆和 Ollama 流式对话。

## 当前能力

- SQLite 角色、会话、消息、知识与记忆持久化
- 角色知识文档自动分块与中文相关性检索
- 每轮回复后提取有长期价值的用户事实与偏好
- 跨会话召回同一角色形成的长期记忆
- 角色身份隔离与设定一致性约束
- 角色和知识库管理 API
- Ollama 本地模型发现、健康检查与流式对话
- 可恢复历史会话的聊天界面

## 本地运行

```bash
pnpm install
pnpm seed
pnpm exec next dev --turbo -p 3100
```

访问 `http://localhost:3100`。Ollama 默认连接 `http://127.0.0.1:11434`。

进入角色聊天页后，左侧可以新建或切换历史会话，查看每轮知识与记忆命中数。展开“管理知识库”可以粘贴角色设定、世界观或剧情资料。所有本地数据都保存在 `data/characteros.db`。

## HTTP API

- `GET/POST /api/characters`：角色列表与创建
- `GET/PATCH/DELETE /api/characters/:id`：角色详情管理
- `GET/POST /api/characters/:id/knowledge`：知识文档列表与添加
- `GET /api/characters/:id/memories`：长期记忆列表
- `GET/POST /api/conversations`：会话列表与创建
- `GET /api/conversations/:id`：恢复会话及消息
- `GET /api/ollama/models`：本地模型发现与延迟检测
- `POST /api/chat`：检索知识与记忆并返回流式回复

## 架构

- `src/domain`：业务模型和输入校验
- `src/server/database`：SQLite 表结构与自动迁移
- `src/server/repositories`：角色、会话、知识和记忆仓储
- `src/server/services`：检索、长期记忆提取和 Ollama 接入
- `src/app/api`：HTTP API
- `src/components`：角色管理和聊天界面
