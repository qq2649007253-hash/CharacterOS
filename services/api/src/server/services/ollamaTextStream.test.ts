import { describe, expect, it, vi } from 'vitest';

import { createOllamaTextStream } from './ollamaTextStream';

const encode = (text: string) => new TextEncoder().encode(text);
const source = (chunks: Uint8Array[]) => new ReadableStream<Uint8Array>({
  start(controller) {
    chunks.forEach((chunk) => controller.enqueue(chunk));
    controller.close();
  },
});
const terminal = '{"done":true}';

describe('Ollama text stream lifecycle', () => {
  it('handles arbitrary byte boundaries, Chinese, CRLF and a terminal frame without newline', async () => {
    const bytes = encode('{"message":{"content":"你好🌟"},"done":false}\r\n\n' + terminal);
    const onComplete = vi.fn();
    const onError = vi.fn();
    const stream = createOllamaTextStream(source(Array.from(bytes, (byte) => new Uint8Array([byte]))), { onComplete, onError });
    expect(await new Response(stream).text()).toBe('你好🌟');
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('你好🌟');
    expect(onError).not.toHaveBeenCalled();
  });

  it.each([
    ['missing terminal', '{"message":{"content":"部分回复"}}\n'],
    ['malformed JSON', 'not-json\n'],
    ['model error', '{"error":"out of memory"}\n'],
    ['invalid content', '{"message":{"content":42}}\n'],
    ['empty output', terminal],
    ['data after terminal', '{"message":{"content":"你好"}}\n' + terminal + '\n{}\n'],
  ])('rejects %s without committing a successful reply', async (_name, payload) => {
    const onComplete = vi.fn();
    const onError = vi.fn();
    const stream = createOllamaTextStream(source([encode(payload)]), { onComplete, onError });
    await expect(new Response(stream).text()).rejects.toThrow();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('records an upstream transport failure', async () => {
    const onError = vi.fn();
    const onComplete = vi.fn();
    const failure = new Error('connection lost');
    const upstream = new ReadableStream<Uint8Array>({ start(controller) { controller.error(failure); } });
    await expect(new Response(createOllamaTextStream(upstream, { onError, onComplete })).text()).rejects.toThrow('connection lost');
    await vi.waitFor(() => expect(onError).toHaveBeenCalledExactlyOnceWith(failure));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('cancels upstream when the consumer stops reading', async () => {
    const cancel = vi.fn();
    const onError = vi.fn();
    const onComplete = vi.fn();
    const upstream = new ReadableStream<Uint8Array>({ cancel });
    const reader = createOllamaTextStream(upstream, { onError, onComplete }).getReader();
    await reader.cancel('user stopped');
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(cancel).toHaveBeenCalledExactlyOnceWith('user stopped');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('propagates request cancellation while waiting for model output', async () => {
    const abort = new AbortController();
    const cancel = vi.fn();
    const onError = vi.fn();
    const onComplete = vi.fn();
    const stream = createOllamaTextStream(new ReadableStream<Uint8Array>({ cancel }), {
      onError, onComplete, signal: abort.signal,
    });
    const result = new Response(stream).text();
    abort.abort();
    await expect(result).rejects.toThrow();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
