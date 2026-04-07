// v0.5 test: pass a fake createOpenClawTools() function that returns a couple
// of stub tools, then bridge them through to the MCP host and have Claude Code
// call them. Proves the AnyAgentTool → AlvastaToolHost adapter works.
import { createClaudeCodeTransportStreamFn } from './src/agents/claude-code-transport-stream.ts';
import { bridgeOpenclawTools } from './src/agents/alvasta-bridge-openclaw-tools.ts';
import { getAlvastaToolHost } from './src/agents/alvasta-tool-host.ts';

async function main() {
  const host = getAlvastaToolHost();
  await host.start();

  // Stub openclaw tools shaped like AnyAgentTool from pi-agent-core
  const fakeTools = [
    {
      name: 'web_search',
      description: 'Search the web for current information',
      label: 'Web Search',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
      async execute(toolCallId: string, params: any) {
        console.log(`[fake openclaw web_search] called with id=${toolCallId} params=${JSON.stringify(params)}`);
        return {
          content: [
            { type: 'text', text: `Search results for "${params.query}": [stub] Today is sunny. Tomorrow is also sunny.` },
          ],
          details: { source: 'stub' },
        };
      },
    },
    {
      name: 'image_generate',
      description: 'Generate an image from a text prompt',
      label: 'Image Generation',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'What to draw' },
        },
        required: ['prompt'],
      },
      async execute(toolCallId: string, params: any) {
        console.log(`[fake openclaw image_generate] called with id=${toolCallId} params=${JSON.stringify(params)}`);
        return {
          content: [
            { type: 'text', text: `Image saved to /tmp/alvasta-img-${Date.now()}.png (prompt: ${params.prompt})` },
          ],
          details: { generated: true },
        };
      },
    },
  ];

  // Bridge them via our v0.5 adapter
  const count = await bridgeOpenclawTools(() => fakeTools);
  console.log(`Bridged ${count} fake openclaw tools.`);
  console.log('Manifest:', host.getManifestPath());
  console.log();

  // Now ask Claude Code to use one
  const streamFn = createClaudeCodeTransportStreamFn();
  const result = streamFn(
    { id: 'claude-code', provider: 'anthropic' } as any,
    {
      messages: [{
        role: 'user',
        content: 'Use the openclaw_web_search tool with the query "Melbourne weather today" then summarize what you got back in one sentence.',
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
      console.log('Tool calls:', toolCalls.length);
      console.log('Final text:', textBuf.trim());
      // Check that the model received the stub data we returned from openclaw
      if (textBuf.includes('sunny')) {
        console.log('\n✓ openclaw native tool reachable from claude --print, full v0.5 wiring works');
      } else {
        console.log('\n✗ stub response not visible in model output');
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
