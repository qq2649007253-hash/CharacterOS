import { manageShare } from '@/server/services/shareService';
const handle = async (request: Request, context: { params: Promise<{ id: string }> }) => manageShare((await context.params).id, request.method);
export { handle as GET, handle as POST, handle as DELETE };
