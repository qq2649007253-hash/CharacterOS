# CharacterOS Architecture

## 边界

```text
Browser UI -> Next.js Route Handlers -> Domain Services -> SQLite / Ollama
```

领域层不依赖 Next.js。HTTP 层不直接执行 SQL；所有数据访问通过仓储完成。Ollama 访问被封装为独立服务，便于测试和替换模型提供方。

## 数据流

1. UI 向 `/api/characters` 提交角色配置。
2. API 使用 Zod 完成边界校验。
3. Repository 将角色保存到 SQLite。
4. 聊天 API 加载角色人设，将其组成 system message 后转发给 Ollama。
5. Ollama 的 NDJSON 流被转换为浏览器可直接消费的纯文本流。

## 安全约束

- Ollama 地址由服务端环境变量配置，客户端不能提交任意目标地址，避免 SSRF。
- 所有写接口都执行结构校验和长度限制。
- SQLite 使用参数化查询。
