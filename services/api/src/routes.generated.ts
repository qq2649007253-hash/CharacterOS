import * as r0 from './routes/observability/runs/route';
import * as r1 from './routes/conversations/route';
import * as r2 from './routes/ollama/models/route';
import * as r3 from './routes/evaluations/route';
import * as r4 from './routes/characters/route';
import * as r5 from './routes/chat/route';
import * as r6 from './routes/tts/route';
import * as r7 from './routes/characters/[id]/knowledge/index/route';
import * as r8 from './routes/characters/[id]/knowledge/route';
import * as r9 from './routes/characters/[id]/memories/route';
import * as r10 from './routes/conversations/[id]/route';
import * as r11 from './routes/characters/[id]/route';
import * as r12 from './routes/tool-calls/[id]/route';
export const routes = [
{ path: '/api/observability/runs', handlers: r0 },
{ path: '/api/conversations', handlers: r1 },
{ path: '/api/ollama/models', handlers: r2 },
{ path: '/api/evaluations', handlers: r3 },
{ path: '/api/characters', handlers: r4 },
{ path: '/api/chat', handlers: r5 },
{ path: '/api/tts', handlers: r6 },
{ path: '/api/characters/[id]/knowledge/index', handlers: r7 },
{ path: '/api/characters/[id]/knowledge', handlers: r8 },
{ path: '/api/characters/[id]/memories', handlers: r9 },
{ path: '/api/conversations/[id]', handlers: r10 },
{ path: '/api/characters/[id]', handlers: r11 },
{ path: '/api/tool-calls/[id]', handlers: r12 }
];
