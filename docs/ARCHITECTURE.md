# CharacterOS Architecture

## 边界

```text
apps/web (Next.js UI, :3100) -> HTTP proxy -> services/api (Node.js, :4318)
services/api -> domain services -> SQLite / Ollama / Edge TTS
apps/desktop (Electron) -> independent Web process + API process
packages/contracts -> shared types and Zod schemas
```

Web 不导入数据库或 API 业务代码。独立 API 不依赖 Next.js，使用标准 Request/Response 路由。HTTP 层不直接执行 SQL；所有数据访问通过仓储完成。Ollama 访问被封装为独立服务，便于测试和替换模型提供方。

## 数据流

1. UI 向 `/api/characters` 提交角色配置。
2. API 使用 Zod 完成边界校验。
3. Repository 将角色保存到 SQLite。
4. 聊天 API 将行为准则、角色背景资料和身份一致性约束组成 system message 后转发给 Ollama。
5. Ollama 的 NDJSON 流被转换为浏览器可直接消费的纯文本流。

## 安全约束

- Ollama 地址由服务端环境变量配置，客户端不能提交任意目标地址，避免 SSRF。
- 所有写接口都执行结构校验和长度限制。
- SQLite 使用参数化查询。

## 数据与语音

默认数据库仍在仓库根目录 data/characteros.db；桌面安装版使用 Electron userData/data。可用 CHARACTEROS_DATA_DIR 覆盖。
账号首次初始化将未归属角色分配给首个管理员。原 ID、消息和记忆保持不变；后续账号独立创建角色。
网页取消请求传递到 API；客户端断开触发 AbortController，聊天输出遵守网络背压。
日常语音播放器独占播放，切换会话取消并释放音频。默认通过本机 9891 桥接 Edge 在线语音，返回 MP3；待朗读文字会发送给微软。
在线桥接最多接纳三个请求，单次生成限制 45 秒；旧 Kokoro 仅作为手动实验工具保留，不自动降级。

## 文档驱动

需求 → 架构决策 → 实施计划 → 代码 → 验收记录。变更先更新对应文档，再实施和记录验证。

- [0.2 需求](requirements/0.2.md)
- [分离决策](architecture/001-separation.md)
- [实施计划](plans/0.2.md)
- [接口约定](api/http.md)
- [验证记录](validation/0.2.md)

pnpm check:boundaries 检查跨层导入；CI 分别执行类型、规范、单元、独立 API 和生产构建检查。
API 默认只监听本机，当前不提供公网多租户认证。

