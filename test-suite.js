/**
 * Automated Test Suite for Universal AI Exporter & Prompt Compressor
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🧪 Starting Universal AI Exporter Test Suite...\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
  }
}

// -------------------------------------------------------------
// TEST 1: Prompt Compressor Unit Tests
// -------------------------------------------------------------
console.log('📦 TEST 1: Prompt Compressor Engine');

const promptCompressorCode = fs.readFileSync(path.join(__dirname, 'prompt-compressor.js'), 'utf8');
const pcContext = { globalThis: {}, module: { exports: {} } };
vm.createContext(pcContext);
vm.runInContext(promptCompressorCode, pcContext);
const PromptCompressor = pcContext.module.exports;

// 1.1 Token Estimation
const sampleText = 'The quick brown fox jumps over the lazy dog and writes some TypeScript code.';
const tokens = PromptCompressor.estimateTokens(sampleText);
assert(tokens > 10 && tokens < 25, `Token estimation realistic: ${tokens} tokens`);

// 1.2 Conversational Filler Stripping
const fillerMessage = 'Sure! I would be happy to help with that. Here is the implementation:\n\n```js\nconst x = 1;\n```\n\nHope this helps! Let me know if you need any adjustments.';
const cleaned = PromptCompressor.stripConversationalFiller(fillerMessage);
assert(!cleaned.includes('happy to help') && !cleaned.includes('Hope this helps!'), 'Conversational filler successfully stripped');
assert(cleaned.includes('const x = 1;'), 'Code block preserved intact');

// 1.3 Full Conversation Compression
const mockConv = {
  platform: 'Claude',
  title: 'Debugging JWT Authentication',
  messages: [
    { role: 'user', sender: 'User', text: 'How do I handle expired JWT tokens in Express?' },
    {
      role: 'assistant',
      sender: 'Claude',
      thoughts: 'Thinking: The user wants to know about refresh tokens. We need to explain rotation and cookies...',
      text: 'Certainly! I can help with that. Here is how you can implement refresh token rotation:\n\n```js\napp.post("/refresh", verifyToken);\n```\n\nLet me know if you have any questions!'
    }
  ]
};

const compResult = PromptCompressor.compressConversation(mockConv, { stripFiller: true, omitThinking: true });
assert(compResult.compressedTokens < compResult.originalTokens, `Tokens compressed: ${compResult.originalTokens} -> ${compResult.compressedTokens} (Saved ${compResult.savingsPercent}%)`);
assert(compResult.messages[1].thoughts === null || compResult.messages[1].thoughts === '', 'Hidden thinking traces omitted from compressed handover');

const clipboardOutput = compResult.toClipboardText();
assert(clipboardOutput.includes('[Prior Conversation Context: Debugging JWT Authentication]'), 'Clipboard handover contains structured context header');
assert(clipboardOutput.includes('[Task Continuation Prompt]'), 'Clipboard handover contains model continuation instruction');

// -------------------------------------------------------------
// TEST 2: Universal AI Exporter Engine Tests
// -------------------------------------------------------------
console.log('\n📦 TEST 2: Universal AI Exporter Formats & Schema Parser');

const exporterCode = fs.readFileSync(path.join(__dirname, 'universal-ai-exporter.js'), 'utf8');
const expContext = {
  globalThis: {},
  module: { exports: {} },
  location: { hostname: 'claude.ai', href: 'https://claude.ai/chat/1b157e5c-4a3f-4e2f-a76f-43d588b8a075' },
  document: { title: 'Claude Test Conversation - Claude' },
  performance: { getEntriesByType: () => [] }
};
vm.createContext(expContext);
vm.runInContext(exporterCode, expContext);
const Exporter = expContext.module.exports;

// 2.1 Format Converters
const mdExport = Exporter.Exporters.toMarkdown(mockConv);
assert(mdExport.content.includes('# Debugging JWT Authentication'), 'Markdown format has correct title');
assert(mdExport.content.includes('## User') && mdExport.content.includes('## Claude'), 'Markdown format has role headers');

const jsonExport = Exporter.Exporters.toJSON(mockConv);
const parsedJson = JSON.parse(jsonExport.content);
assert(parsedJson.platform === 'Claude' && parsedJson.messages.length === 2, 'JSON export is valid and structured');

const htmlExport = Exporter.Exporters.toHTML(mockConv);
assert(htmlExport.content.includes('<!DOCTYPE html>') && htmlExport.content.includes('Debugging JWT Authentication'), 'HTML export creates valid standalone document');

// 2.2 Claude Schema Parser Simulation (196-message API structure + Pasted Text Attachments)
const claudeMockData = {
  uuid: '1b157e5c-4a3f-4e2f-a76f-43d588b8a075',
  name: 'Long Claude Project Session',
  model: 'claude-3-5-sonnet-20241022',
  chat_messages: [
    {
      sender: 'human',
      text: '', // User only sent a pasted box without typing additional prompt text
      attachments: [
        {
          file_name: 'pasted_code.py',
          file_size: 4500,
          extracted_content: 'def calculate_metrics():\n    return {"accuracy": 0.98}'
        }
      ],
      created_at: '2026-10-06T18:00:00Z'
    },
    {
      sender: 'assistant',
      content: [
        { type: 'thinking', thinking: 'Analyze query...' },
        { type: 'text', text: 'Hello! I analyzed your calculate_metrics function.' },
        { type: 'tool_use', name: 'search_docs', input: { q: 'react' } }
      ],
      created_at: '2026-10-06T18:01:00Z'
    }
  ]
};

// Test Claude Pasted Text Extraction
expContext.globalThis.__UNIVERSAL_AI_CACHE__ = expContext.globalThis.__UNIVERSAL_AI_CACHE__ || { claude: {}, chatgpt: {} };
expContext.globalThis.__UNIVERSAL_AI_CACHE__.claude['1b157e5c-4a3f-4e2f-a76f-43d588b8a075'] = claudeMockData;

async function runAsyncTests() {
  const claudeResult = await Exporter.Adapters.claude.extract();
  assert(claudeResult && claudeResult.messages.length === 2, 'Claude extracted all messages including pure pasted text inputs');
  assert(claudeResult.messages[0].text.includes('pasted_code.py'), 'Claude pasted text filename preserved');
  assert(claudeResult.messages[0].text.includes('def calculate_metrics():'), 'Claude pasted text contents extracted from extracted_content');

  // 2.3 ChatGPT DAG Mapping Tree Parser Simulation with Pasted Text Download
  const testConvUuid = '67030e22-1234-5678-90ab-cdef12345678';
  const chatgptMockData = {
    title: 'ChatGPT Python Refactor',
    current_node: 'node-3',
    mapping: {
      'node-1': { id: 'node-1', parent: null, children: ['node-2'], message: { author: { role: 'system' }, content: { parts: [''] } } },
      'node-2': {
        id: 'node-2',
        parent: 'node-1',
        children: ['node-3'],
        message: {
          author: { role: 'user' },
          content: {
            parts: [
              {
                content_type: 'multimodal_text',
                asset_pointer: 'file-service://file-mock123',
                name: 'pasted text.txt'
              }
            ]
          },
          metadata: {
            attachments: [
              { id: 'file-mock123', name: 'pasted text.txt', mime_type: 'text/plain' }
            ]
          }
        }
      },
      'node-3': { id: 'node-3', parent: 'node-2', children: ['node-4'], message: { author: { role: 'assistant' }, content: { content_type: 'code', text: 'print("hello world")' }, metadata: { thought: 'Reviewing PEP8 guidelines' } } },
      'node-4': { id: 'node-4', parent: 'node-3', children: [], message: { author: { role: 'tool', name: 'python' }, content: { content_type: 'execution_output', text: 'hello world' } } }
    }
  };

  // Mock fetch for ChatGPT file downloading
  expContext.fetch = async (url) => {
    if (url.includes('/backend-api/files/file-mock123/download')) {
      return {
        ok: true,
        json: async () => ({ status: 'success', download_url: 'https://files.oaiusercontent.com/mock-file-mock123' })
      };
    }
    if (url === 'https://files.oaiusercontent.com/mock-file-mock123') {
      return {
        ok: true,
        text: async () => 'class DataPipeline:\n    def run(self):\n        return True'
      };
    }
    return { ok: false, status: 404 };
  };

  expContext.globalThis.__UNIVERSAL_AI_CACHE__.chatgpt[testConvUuid] = chatgptMockData;
  expContext.globalThis.__UNIVERSAL_AI_CACHE__.chatgpt.latest = chatgptMockData;
  expContext.location = { hostname: 'chatgpt.com', href: `https://chatgpt.com/c/${testConvUuid}`, origin: 'https://chatgpt.com' };

  const gptResult = await Exporter.Adapters.chatgpt.extract();
  assert(gptResult && gptResult.messages.length === 3, 'ChatGPT extracted user message with pasted text, assistant, and tool');
  assert(gptResult.messages[0].text.includes('pasted text.txt'), 'ChatGPT pasted text attachment title preserved');
  assert(gptResult.messages[0].text.includes('class DataPipeline:'), 'ChatGPT pasted text downloaded and embedded cleanly');

  assert(Exporter.Adapters.chatgpt !== undefined, 'ChatGPT adapter is registered in Universal AI Exporter');
  assert(Exporter.Adapters.chatgpt.matches('chatgpt.com'), 'ChatGPT adapter matches chatgpt.com');
  assert(Exporter.Adapters.chatgpt.matches('chat.openai.com'), 'ChatGPT adapter matches chat.openai.com');

  // 2.4 GLM DOM Extraction Simulation
  assert(Exporter.Adapters.glm !== undefined, 'GLM adapter is registered in Universal AI Exporter');
  assert(Exporter.Adapters.glm.matches('chatglm.cn'), 'GLM adapter matches chatglm.cn');
  assert(Exporter.Adapters.glm.matches('chat.z.ai'), 'GLM adapter matches chat.z.ai');
  assert(Exporter.Adapters.glm.matches('bigmodel.cn'), 'GLM adapter matches bigmodel.cn');

  // 2.5 Google AI Studio Adapter Verification & Textarea Extraction Simulation
  assert(Exporter.Adapters.gemini !== undefined, 'Gemini/AI Studio adapter is registered in Universal AI Exporter');
  assert(Exporter.Adapters.gemini.matches('gemini.google.com'), 'Gemini adapter matches gemini.google.com');
  assert(Exporter.Adapters.gemini.matches('aistudio.google.com'), 'Gemini adapter matches aistudio.google.com');

  // Mock AI Studio DOM
  expContext.location = { hostname: 'aistudio.google.com', pathname: '/prompts/prompt-12345' };
  expContext.document = {
    title: 'Code Refactor Project - Google AI Studio',
    querySelectorAll: (sel) => {
      if (sel.includes('ms-chat-turn') || sel.includes('data-turn-role')) {
        return [
          {
            getAttribute: (attr) => attr === 'data-turn-role' ? 'User' : null,
            className: 'chat-turn-container user',
            querySelectorAll: (subSel) => {
              if (subSel === 'textarea') {
                return [{ value: 'Write a unit test for my API' }];
              }
              if (subSel === '[contenteditable="true"]') return [];
              return [];
            },
            querySelector: (subSel) => {
              if (subSel.includes('user')) return true;
              return null;
            },
            cloneNode: function() { return this; },
            innerText: ''
          },
          {
            getAttribute: (attr) => attr === 'data-turn-role' ? 'Model' : null,
            className: 'chat-turn-container model',
            querySelectorAll: (subSel) => [],
            querySelector: (subSel) => {
              if (subSel.includes('thought')) return null;
              return null;
            },
            cloneNode: function() { return this; },
            innerText: 'Here is the comprehensive test suite using jest.'
          }
        ];
      }
      return [];
    }
  };

  const aiStudioResult = await Exporter.Adapters.gemini.extract();
  assert(aiStudioResult && aiStudioResult.platform === 'Google AI Studio', 'Google AI Studio platform recognized correctly');
  assert(aiStudioResult.messages.length === 2, 'AI Studio extracted both user and assistant turns');
  assert(aiStudioResult.messages[0].role === 'user' && aiStudioResult.messages[0].text === 'Write a unit test for my API', 'AI Studio successfully extracted user input from textarea value');
  assert(aiStudioResult.messages[1].role === 'assistant' && aiStudioResult.messages[1].text.includes('Here is the comprehensive test suite'), 'AI Studio successfully extracted assistant response');

  // -------------------------------------------------------------
  // TEST 3: File Syntax & Bundle Verification
  // -------------------------------------------------------------
  console.log('\n📦 TEST 3: Syntax Verification of All Scripts');

  const filesToValidate = [
    'universal-snippet.js',
    'universal-ai-exporter.user.js',
    'extension/content.js',
    'extension/popup.js',
    'claude-export-snippet.js'
  ];

  for (const file of filesToValidate) {
    try {
      const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
      new vm.Script(code);
      assert(true, `${file} syntax is clean and valid`);
    } catch (err) {
      assert(false, `${file} syntax error: ${err.message}`);
    }
  }

  // Summary
  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
  console.log(`========================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runAsyncTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
