// Direct test of the Claude Code transport stream — no gateway required.
// Imports the compiled module and runs it with a fake context.

import { createClaudeCodeTransportStreamFn } from './dist/agents/claude-code-transport-stream.js';

const streamFn = createClaudeCodeTransportStreamFn();
const fakeModel = { id: 'claude-code', provider: 'anthropic' };
const fakeContext = {
  messages: [
    { role: 'user', content: 'Reply with exactly the word PROOF and nothing else.' }
  ],
  systemPrompt: '',
  tools: []
};
const fakeOptions = {};

console.log('Calling Claude Code transport stream...');
const eventStream = streamFn(fakeModel, fakeContext, fakeOptions);

console.log('Got event stream, iterating...');
let collected = '';
let eventCount = 0;
for await (const event of eventStream) {
  eventCount++;
  if (event.type === 'text_delta') {
    collected += event.delta;
  } else if (event.type === 'done') {
    console.log('\n--- DONE ---');
    console.log('Stop reason:', event.reason);
    console.log('Final text:', collected.trim());
    console.log('Total events:', eventCount);
    break;
  } else if (event.type === 'error') {
    console.log('--- ERROR ---');
    console.log(event.error);
    process.exit(1);
  } else {
    console.log('Event:', event.type);
  }
}
