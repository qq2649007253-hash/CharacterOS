# HTTP 接口

默认 API 为 http://127.0.0.1:4318；网页通过 /api/* 同源转发。CHARACTEROS_API_URL 指定网页连接的后端。

| 路径 | 方法 | 用途 |
| --- | --- | --- |
| /health | GET | API 存活检测 |
| /api/characters | GET / POST | 列表 / 新建 |
| /api/characters/:id | GET / PATCH / DELETE | 读取 / 编辑 / 删除 |
| /api/characters/:id/knowledge | GET / POST | 知识管理 |
| /api/characters/:id/knowledge/index | POST | 向量索引 |
| /api/characters/:id/memories | GET | 长期记忆 |
| /api/conversations | GET / POST | 列表（characterId 查询参数）/ 新建 |
| /api/conversations/:id | GET | 会话与消息 |
| /api/chat | POST | 流式聊天 |
| /api/tts | GET / POST | 语音健康 / 在线 MP3 合成 |
| /api/ollama/models | GET | 模型与健康 |
| /api/observability/runs | GET | 运行轨迹 |
| /api/evaluations | GET / POST | 回归评测 |
| /api/tool-calls/:id | PATCH | 审批工具调用 |

新建角色返回 201 和角色对象；新建会话返回 201 与 `{ conversation }`。校验失败 400、资源缺失 404、不支持的方法 405；请求体上限 2 MiB。

聊天提交 `{ characterId, conversationId, content }`，通常返回 UTF-8 文本流，待审批工具返回 202 JSON。取消必须传递 AbortSignal；网络断开不能视为完整回复。

语音提交 `{ characterId, text }` 或试听 `{ voiceId, text }`，文字 1–3000 字。成功返回 audio/mpeg，失败返回 JSON。客户端校验状态和音频类型，不将错误内容当音频播放。

数据库路径和模型连接配置只在后端使用，不进入浏览器产物。

会话列表分页：GET /api/conversations?characterId=...&limit=20&cursor=...。limit 为 1–50，默认 20。返回 `{ conversations, nextCursor }`；nextCursor 为 null 时已到末页。游标按 updatedAt 与 id 倒序翻页，客户端应追加并按 id 去重。其他窗口更新可能改变实时排序，重新加载第一页可获取最新列表。非法参数返回 400。

账号接口：GET /api/auth/me 返回 user 与 needsSetup；POST /api/auth/setup、register、login 提交 username/password；POST /api/auth/logout 撤销当前会话。register 只能创建普通用户。GET/POST/PATCH /api/admin/users 仅管理员可用，POST 创建普通账号，PATCH 提交 id、role、disabled，不能修改自己。其他业务接口未登录返回 401，跨账号资源返回 404，管理员权限不足返回 403。所有写请求采用 application/json。
