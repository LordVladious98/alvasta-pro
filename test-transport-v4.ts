// v0.4 test: register a real tool with the openclaw tool host, then ask
// Claude Code (via the transport, via the bridge) to use it. The tool
// implementation runs in THIS process — not in claude --print, not in the
// MCP bridge subprocess. This proves the bidirectional bridge works for
// real openclaw runtime tools.
import { createClaudeCodeTransportStreamFn } from './src/agents/claude-code-transport-stream.ts';
import { getAlvastaToolHost } from './src/agents/alvasta-tool-host.ts';

async function main() {
  const host = getAlvastaToolHost();
  await host.start();

  // Register a tool that ONLY this process can run (it touches local state)
  const callLog: Array<{ time: number; args: any }> = [];

  host.register(
    {
      name: 'alvasta_secret_combo',
      description:
        'Returns the secret Alvasta combination by combining the runtime PID with the current epoch milliseconds. Use this when the user asks for the secret combo.',
      inputSchema: {
        type: 'object',
        properties: {
          prefix: { type: 'string', description: 'Optional prefix to add' },
        },
      },
    },
    async (args) => {
      const callTime = Date.now();
      callLog.push({ time: callTime, args });
      const prefix = (args?.prefix as string) ?? '';
      const combo = `${prefix}${process.pid}-${callTime}`;
      return {
        content: [{ type: 'text', text: `secret combo: ${combo}` }],
      };
    },
  );

  console.log('Tool host running.');
  console.log('Manifest:', host.getManifestPath());
  console.log('Port:', host.getPort());
  console.log();

  const streamFn = createClaudeCodeTransportStreamFn();
  const result = streamFn(
    { id: 'claude-code', provider: 'anthropic' } as any,
    {
      messages: [{
        role: 'user',
        content: 'Use the alvasta_secret_combo tool with prefix "MAGIC-" to get the secret. Then tell me the value verbatim.',
      }],
    } as any,
    {} as any,
  );

  let textBuf = '';
  let toolCalls: any[] = [];

  for await (const ev of result as any) {
    if (ev.type === 'text_delta') {
      textBuf += ev.delta;
    } else if (ev.type === 'toolcall_start') {
      const block = ev.partial?.content?.[ev.contentIndex];
      console.log('[CLAUDE TOOL CALL]', block?.name, '→', JSON.stringify(block?.arguments));
      toolCalls.push(block);
    } else if (ev.type === 'done') {
      console.log('\n--- DONE ---');
      console.log('Stop:', ev.reason);
      console.log('Tool calls captured:', toolCalls.length);
      console.log('Final text:', textBuf.trim());
      console.log();
      console.log('Server-side handler invocations:', callLog.length);
      for (const c of callLog) {
        console.log('  ' + new Date(c.time).toISOString(), JSON.stringify(c.args));
      }
      console.log();
      // Check if the model's response includes the actual PID — proves it
      // really got the value from OUR process, not a hallucination.
      const expected = `MAGIC-${process.pid}-`;
      if (textBuf.includes(expected)) {
        console.log('✓ BRIDGE END-TO-END VERIFIED: model received the real value (' + expected + 'XXX)');
      } else {
        console.log('✗ Model output did NOT include expected ' + expected);
      }
      host.stop();
      return;
    } else if (ev.type === 'error') {
      console.log('--- ERROR ---', JSON.stringify(ev, null, 2));
      host.stop();
      process.exit(1);
    }
  }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
