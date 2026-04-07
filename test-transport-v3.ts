// v0.3 test: ask Claude Code to use a tool from the Alvasta MCP bridge
import { createClaudeCodeTransportStreamFn } from './src/agents/claude-code-transport-stream.ts';

async function main() {
  const streamFn = createClaudeCodeTransportStreamFn();
  const result = streamFn(
    { id: 'claude-code', provider: 'anthropic' } as any,
    {
      messages: [{
        role: 'user',
        content: 'Use the alvasta_echo tool to echo the word "BRIDGE_OK" then summarize what the tool returned in one sentence.'
      }],
    } as any,
    {} as any,
  );

  let textBuf = '';
  let toolCalls: any[] = [];
  let count = 0;

  for await (const ev of result as any) {
    count++;
    if (ev.type === 'text_delta') {
      textBuf += ev.delta;
    } else if (ev.type === 'toolcall_start') {
      const block = ev.partial?.content?.[ev.contentIndex];
      console.log('[TOOL CALL]', block?.name, '→', JSON.stringify(block?.arguments));
      toolCalls.push(block);
    } else if (ev.type === 'done') {
      console.log('\n--- DONE ---');
      console.log('Stop reason:', ev.reason);
      console.log('Tool calls:', toolCalls.length);
      console.log('Final text:', textBuf.trim());
      console.log('Total events:', count);
      return;
    } else if (ev.type === 'error') {
      console.log('--- ERROR ---', JSON.stringify(ev, null, 2));
      process.exit(1);
    }
  }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
