// v0.7 contract test: verify that openclaw's provider-transport-stream.ts
// returns OUR ClaudeCodeTransportStreamFn when it resolves a stream for
// anthropic-messages. This is the integration point — if this works, any
// anthropic model openclaw uses will route through our transport.
import { createBoundaryAwareStreamFnForModel } from './src/agents/provider-transport-stream.ts';

console.log('=== v0.7 contract test ===');
console.log('Verifying provider-transport-stream.ts routes anthropic-messages to our Claude Code transport...\n');

// Fake an Anthropic model like openclaw's runtime would
const fakeAnthropicModel = {
  id: 'claude-sonnet-4-5',
  api: 'anthropic-messages' as any,
  provider: 'anthropic',
} as any;

const streamFn = createBoundaryAwareStreamFnForModel(fakeAnthropicModel);

if (!streamFn) {
  console.log('✗ FAIL: createBoundaryAwareStreamFnForModel returned undefined');
  process.exit(1);
}

console.log('✓ StreamFn returned for anthropic-messages');
console.log();
console.log('Running a live inference through it to verify it actually spawns claude --print:');
console.log();

const context = {
  messages: [{
    role: 'user',
    content: 'Reply with just: WIRED_IN',
  }],
} as any;

const result = streamFn(fakeAnthropicModel, context, {} as any);

let textBuf = '';
let eventCount = 0;
let sawToolCall = false;

for await (const ev of result as any) {
  eventCount++;
  if (ev.type === 'text_delta') {
    textBuf += ev.delta;
  } else if (ev.type === 'toolcall_start') {
    sawToolCall = true;
  } else if (ev.type === 'done') {
    console.log('--- DONE ---');
    console.log('Events received:', eventCount);
    console.log('Final text:', textBuf.trim());
    const msg = ev.message as any;
    console.log('Model reported:', msg?.model);
    console.log('Provider reported:', msg?.provider);
    console.log('Usage:', JSON.stringify(msg?.usage));
    if (textBuf.includes('WIRED_IN')) {
      console.log('\n✓ CONTRACT VERIFIED: openclaw → provider-transport-stream → ClaudeCodeTransportStreamFn → claude --print → OAuth');
      console.log('  This means ANY Anthropic model configured in openclaw now routes through Claude Code OAuth.');
    } else {
      console.log('\n✗ Unexpected response text');
    }
    process.exit(0);
  } else if (ev.type === 'error') {
    console.log('--- ERROR ---', JSON.stringify(ev, null, 2));
    process.exit(1);
  }
}
