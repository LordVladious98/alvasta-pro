import { createClaudeCodeTransportStreamFn } from './src/agents/claude-code-transport-stream.ts';

async function main() {
  const streamFn = createClaudeCodeTransportStreamFn();
  const result = streamFn(
    { id: 'claude-code', provider: 'anthropic' } as any,
    { messages: [{ role: 'user', content: 'Reply with exactly the word PROOF and nothing else.' }] } as any,
    {} as any
  );

  let collected = '';
  let count = 0;
  for await (const ev of result as any) {
    count++;
    if (ev.type === 'text_delta') collected += ev.delta;
    else if (ev.type === 'done') {
      console.log('FINAL:', collected.trim());
      console.log('events:', count);
      return;
    } else if (ev.type === 'error') {
      console.log('ERR:', JSON.stringify(ev, null, 2));
      process.exit(1);
    } else {
      console.log('event:', ev.type);
    }
  }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
