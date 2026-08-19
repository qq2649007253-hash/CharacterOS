import { NextResponse } from 'next/server';

import { agentRunRepository } from '@/server/repositories/agentRunRepository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = () => NextResponse.json({ runs: agentRunRepository.list() });
