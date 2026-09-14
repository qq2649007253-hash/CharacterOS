import { receiveShare } from '@/server/services/shareService';
const handle = async (request: Request, context: { params: Promise<{ token: string }> }) => receiveShare((await context.params).token, request.method);
export { handle as GET, handle as POST };
