import { z } from 'zod';

const frameSchema = z.object({
  done: z.boolean().optional(),
  error: z.string().optional(),
  message: z.object({ content: z.string().optional() }).optional(),
});

interface StreamLifecycle {
  onComplete: (content: string) => void | Promise<void>;
  onError: (error: unknown) => void;
  signal?: AbortSignal;
}

/** Completion is committed only after a valid terminal frame and clean EOF. */
export function createOllamaTextStream(upstream: ReadableStream<Uint8Array>, lifecycle: StreamLifecycle) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const encoder = new TextEncoder();
  let pending = '';
  let content = '';
  let completed = false;

  const consume = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    if (!line.trim()) return;
    if (completed) throw new Error('模型在完成标记后仍返回数据');
    const frame = frameSchema.parse(JSON.parse(line));
    if (frame.error !== undefined) throw new Error(`模型流错误：${frame.error}`);
    const delta = frame.message?.content;
    if (delta) {
      content += delta;
      controller.enqueue(encoder.encode(delta));
    }
    if (frame.done === true) completed = true;
  };

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      pending += decoder.decode(chunk, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() || '';
      for (const line of lines) consume(line, controller);
    },
    async flush(controller) {
      pending += decoder.decode();
      consume(pending, controller);
      if (!completed) throw new Error('模型回复中断：未收到完成标记');
      if (!content.trim()) throw new Error('模型未返回有效回复');
      await lifecycle.onComplete(content);
    },
  });

  // pipeTo observes transport errors and downstream cancellation as well as parsing errors.
  void upstream.pipeTo(transform.writable, { signal: lifecycle.signal }).catch((error: unknown) => {
    lifecycle.onError(error);
  }).catch((error: unknown) => {
    console.error('Failed to record chat stream error:', error);
  });
  return transform.readable;
}
