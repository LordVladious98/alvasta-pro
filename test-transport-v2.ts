// v0.2 test: stream-json + tool_use translation
import { createClaudeCodeTransportStreamFn } from './src/agents/claude-code-transport-stream.ts';

async function main() {
  const streamFn = createClaudeCodeTransportStreamFn();
  const result = streamFn(
    { id: 'claude-code', provider: 'anthropic' } as any,
    {
      messages: [{
        role: 'user',
        content: 'Run the date command via Bash and tell me the output. Be brief.'
      }],
    } as any,
    {} as any,
  );

  let textBuf = '';
  let toolCalls: Array<{ name: string; args: unknown }> = [];
  let count = 0;

  for await (const ev of result as any) {
    count++;
    if (ev.type === 'text_delta') {
      textBuf += ev.delta;
    } else if (ev.type === 'toolcall_start') {
      console.log('[toolcall_start]');
    } else if (ev.type === 'toolcall_delta') {
      console.log('[toolcall_delta]', ev.delta);
    } else if (ev.type === 'done') {
      console.log('\n--- DONE ---');
      console.log('Stop reason:', ev.reason);
      console.log('Final text:', textBuf.trim());
      console.log('Total events:', count);
      const msg = ev.message as any;
      if (msg?.usage) {
        console.log('Usage:', JSON.stringify(msg.usage));
      }
      console.log('Content blocks:', msg?.content?.length);
      return;
    } else if (ev.type === 'error') {
      console.log('--- ERROR ---', JSON.stringify(ev, null, 2));
      process.exit(1);
    } else {
      console.log('event:', ev.type);
    }
  }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
