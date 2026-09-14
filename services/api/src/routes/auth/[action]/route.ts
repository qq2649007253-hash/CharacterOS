import { authAction } from '@/server/services/authService';
const handle = async (request: Request, context: { params: Promise<{ action: string }> }) => authAction(request, (await context.params).action);
export { handle as GET, handle as POST };
