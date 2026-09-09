

import { agentRunRepository } from '@/server/repositories/agentRunRepository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = () => Response.json({ runs: agentRunRepository.list() });
