/**
 * Universal AI Exporter & Context Compressor - Single Paste Console Snippet (v3.1)
 * Works on: Claude, ChatGPT, DeepSeek, GLM / ChatGLM / Z.ai, Google Gemini, Perplexity, Mistral, Copilot, Grok, and Local WebUIs.
 * 
 * Features:
 * - Multi-Platform Network & DOM Sniffing (Now with native GLM / ChatGLM support)
 * - 5-Stage Universal DOM Fallback Engine that never fails on active chats
 * - Automatic Token Compression (Strips conversational filler, trims thinking traces)
 * - 1-Click Clipboard Copy formatted for the Next AI
 * - Instant Markdown File Download
 */
(async () => {
  console.log("%c⚡ Universal AI Exporter & Prompt Compressor (v3.1) starting...", "color: #38bdf8; font-weight: bold; font-size: 14px;");

  function clean(t) {
    return t ? String(t).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim() : "";
  }

  function estimateTokens(text) {
    if (!text) return 0;
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.round((text.length / 3.8 + words * 1.25) / 2));
  }

  function stripFiller(text) {
    if (!text) return "";
    let c = text.trim();
    c = c.replace(/^(sure|certainly|absolutely|of course|gladly|happy to help|yes)[!.,]?\s*(i'd be happy to|i would be happy to|i can help with that|i can help|here is|here's|below is)?[^.\n]*[.:]?/i, "");
    c = c.replace(/^(hello|hi|hey there)[!.,]?\s*/i, "");
    c = c.replace(/^(as an ai language model|as an ai|as claude|as chatgpt)[,.]?\s*/i, "");
    c = c.replace(/(let me know if you (need|have) (any|more) (further )?(help|questions|adjustments|feedback)[!.]?)\s*$/i, "");
    c = c.replace(/(hope this helps|i hope this helps|happy coding)[!.]?\s*$/i, "");
    return c.trim();
  }

  function download(content, filename, mime) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const host = location.hostname;
  let conv = { platform: "AI Chat", title: clean(document.title) || "AI_Chat", messages: [] };

  // 1. CLAUDE (Network Re-fetch + Org Resolver)
  if (host.includes("claude.ai")) {
    conv.platform = "Claude";
    const uuid = location.href.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    let raw = null;
    if (typeof performance !== "undefined" && uuid) {
      const match = performance.getEntriesByType("resource").map(e => e.name).reverse().find(u => u.includes(uuid) && u.includes("/chat_conversations/"));
      if (match) {
        try { const r = await fetch(match, { credentials: "include" }); if (r.ok) raw = await r.json(); } catch (_) {}
      }
    }
    if (!raw && uuid) {
      const org = document.cookie.match(/lastActiveOrg=([0-9a-f-]+)/i)?.[1];
      if (org) {
        try {
          const r = await fetch(`https://claude.ai/api/organizations/${org}/chat_conversations/${uuid}?tree=True&rendering_mode=messages&render_all_tools=true&include_inline_comparison=true&consistency=strong`, { credentials: "include" });
          if (r.ok) raw = await r.json();
        } catch (_) {}
      }
    }
    if (raw && (raw.chat_messages || raw.messages)) {
      conv.title = raw.name || conv.title;
      const msgs = raw.chat_messages || raw.messages;
      conv.messages = msgs.map(m => {
        let text = m.text || "";
        let thoughts = "";
        const attParts = [];

        if (Array.isArray(m.content)) {
          const parts = [];
          for (const b of m.content) {
            if (!b) continue;
            if (typeof b === "string") parts.push(b);
            else if (b.type === "thinking") thoughts += (b.thinking || "") + "\n";
            else if (b.type === "text") { if (b.text) parts.push(b.text); }
            else if (b.type === "tool_use" || b.name) parts.push(`> 🛠 **Tool (${b.name}):** \`${JSON.stringify(b.input)}\``);
            else if (b.type === "tool_result") parts.push(`> 📋 **Tool Result:**\n\`\`\`\n${typeof b.content === "string" ? b.content : JSON.stringify(b.content, null, 2)}\n\`\`\``);
            else if (b.type === "document" || b.type === "attachment") {
              const docContent = b.source?.data || b.extracted_content || b.text || b.content || "";
              const docName = b.title || b.file_name || b.name || "Pasted document";
              if (docContent && typeof docContent === "string" && docContent.trim()) {
                attParts.push(`📎 **[${docName}]:**\n\`\`\`\n${docContent.trim()}\n\`\`\``);
              }
            }
          }
          const joinedParts = parts.filter(Boolean).join("\n\n");
          if (joinedParts) text = joinedParts;
        }

        // Claude attachments & files (where Claude stores pasted text blocks & uploaded files)
        const allAtts = [...(m.attachments || []), ...(m.files || [])];
        for (const att of allAtts) {
          if (!att) continue;
          const content = att.extracted_content || att.content || att.text || "";
          const name = att.file_name || att.name || "Pasted text";
          if (content && typeof content === "string" && content.trim()) {
            attParts.push(`📎 **[${name}]:**\n\`\`\`\n${content.trim()}\n\`\`\``);
          }
        }

        if (attParts.length > 0) {
          text = text ? `${text}\n\n${attParts.join("\n\n")}` : attParts.join("\n\n");
        }

        return {
          role: (m.sender === "human" || m.sender === "user") ? "user" : "assistant",
          sender: (m.sender === "human" || m.sender === "user") ? "User" : "Claude",
          text: clean(text),
          thoughts: clean(thoughts)
        };
      }).filter(m => m.text || m.thoughts);
    }
  }

  // 2. CHATGPT (Backend Tree Re-fetch + Auth Session Token + DAG Traversal)
  else if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) {
    conv.platform = "ChatGPT";

    // Step A: Resolve Auth Token & Account ID
    let authToken = null;
    let accountId = null;
    try {
      const nextData = window.__NEXT_DATA__;
      authToken = nextData?.props?.pageProps?.session?.accessToken ||
                  nextData?.props?.pageProps?.accessToken ||
                  nextData?.props?.session?.accessToken;
      accountId = nextData?.props?.pageProps?.session?.account?.id ||
                  nextData?.props?.pageProps?.account?.id;
    } catch (_) {}

    if (!authToken) {
      try {
        const sessRes = await fetch("/api/auth/session", { credentials: "include" });
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          authToken = sessData?.accessToken || null;
          accountId = sessData?.account?.id || null;
        }
      } catch (_) {}
    }

    const authHeaders = { "Accept": "application/json" };
    if (authToken) authHeaders["Authorization"] = `Bearer ${authToken}`;
    if (accountId) authHeaders["chatgpt-account-id"] = accountId;

    // Step B: Resolve Conversation ID
    let convId = location.href.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[0];
    if (!convId && typeof performance !== "undefined") {
      const entries = performance.getEntriesByType("resource");
      for (let i = entries.length - 1; i >= 0; i--) {
        const m = entries[i].name.match(/conversation\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (m) { convId = m[1]; break; }
      }
    }

    // Fallback: If on root or fresh chat, query recent conversation ID
    if (!convId && authToken) {
      try {
        const listRes = await fetch(`${location.origin}/backend-api/conversations?offset=0&limit=3&order=updated`, {
          credentials: "include",
          headers: authHeaders
        });
        if (listRes.ok) {
          const listJson = await listRes.json();
          if (listJson?.items?.[0]?.id) convId = listJson.items[0].id;
        }
      } catch (_) {}
    }

    // Step C: Fetch full conversation tree from internal API
    let raw = null;
    const isShare = location.pathname.includes("/share/");
    const endpoint = convId
      ? `${location.origin}/backend-api/${isShare ? "share" : "conversation"}/${convId}`
      : null;

    if (endpoint) {
      try {
        const r = await fetch(endpoint, { credentials: "include", headers: authHeaders });
        if (r.ok) raw = await r.json();
      } catch (_) {}
    }

    if (!raw && typeof performance !== "undefined") {
      const match = performance.getEntriesByType("resource").map(e => e.name).reverse().find(u => u.includes("/backend-api/conversation/") || (convId && u.includes(convId)));
      if (match) {
        try {
          const r = await fetch(match, { credentials: "include", headers: authHeaders });
          if (r.ok) raw = await r.json();
        } catch (_) {}
      }
    }

    // Step D: Extract full DAG history down to deepest leaf
    if (raw && raw.mapping) {
      conv.title = raw.title || conv.title;
      let curr = raw.current_node;

      // Find deepest active leaf node
      if (!curr || !raw.mapping[curr]) {
        const allNodes = Object.values(raw.mapping);
        const leaves = allNodes.filter(n => !n.children || n.children.length === 0);
        leaves.sort((a, b) => ((b.message?.create_time || 0) - (a.message?.create_time || 0)));
        if (leaves.length > 0) curr = leaves[0].id;
      }

      while (raw.mapping[curr] && Array.isArray(raw.mapping[curr].children) && raw.mapping[curr].children.length > 0) {
        const children = raw.mapping[curr].children;
        curr = children[children.length - 1];
      }

      const nodes = [];
      const visited = new Set();
      while (curr && raw.mapping[curr] && !visited.has(curr)) {
        visited.add(curr);
        nodes.unshift(raw.mapping[curr]);
        curr = raw.mapping[curr].parent;
      }

      function isTextAttachment(name, mimeType) {
        const n = (name || "").toLowerCase();
        const m = (mimeType || "").toLowerCase();
        if (m.startsWith("text/")) return true;
        if (m.includes("json") || m.includes("javascript") || m.includes("xml") || m.includes("csv")) return true;
        if (n.includes("pasted") || n.includes("paste") || n.includes("untitled")) return true;
        const textExts = [
          ".txt", ".md", ".markdown", ".json", ".csv", ".tsv", ".xml", ".html", ".htm",
          ".css", ".scss", ".sass", ".js", ".jsx", ".ts", ".tsx", ".py", ".pyw",
          ".java", ".c", ".h", ".cpp", ".hpp", ".cs", ".go", ".rs", ".php", ".rb",
          ".swift", ".kt", ".kts", ".sh", ".bash", ".zsh", ".bat", ".cmd", ".ps1",
          ".sql", ".r", ".m", ".lua", ".yaml", ".yml", ".toml", ".ini", ".conf",
          ".env", ".log", ".diff", ".patch", ".tex", ".dockerfile"
        ];
        return textExts.some(ext => n.endsWith(ext));
      }

      const fileCache = new Map();
      async function fetchChatGptFile(fileId) {
        if (!fileId || typeof fileId !== "string") return null;
        if (fileCache.has(fileId)) return fileCache.get(fileId);
        try {
          const origin = (typeof location !== "undefined" && location.origin) ? location.origin : "https://chatgpt.com";
          const res = await fetch(`${origin}/backend-api/files/${fileId}/download`, {
            credentials: "include",
            headers: authHeaders
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.download_url) {
              const textRes = await fetch(data.download_url);
              if (textRes.ok) {
                const content = await textRes.text();
                fileCache.set(fileId, content);
                return content;
              }
            }
          }
        } catch (_) {}
        fileCache.set(fileId, null);
        return null;
      }

      // Pre-fetch all text attachments / pasted text files in parallel
      const filesToFetch = [];
      for (const n of nodes) {
        const msg = n.message;
        if (!msg) continue;
        if (Array.isArray(msg.metadata?.attachments)) {
          for (const att of msg.metadata.attachments) {
            if (att && att.id && isTextAttachment(att.name, att.mime_type)) {
              filesToFetch.push(att.id);
            }
          }
        }
        if (Array.isArray(msg.content?.parts)) {
          for (const p of msg.content.parts) {
            if (p && typeof p === "object") {
              let fid = null;
              if (typeof p.asset_pointer === "string" && p.asset_pointer.startsWith("file-service://")) {
                fid = p.asset_pointer.replace("file-service://", "");
              } else if (typeof p.id === "string" && p.id.startsWith("file-")) {
                fid = p.id;
              }
              if (fid && isTextAttachment(p.name, p.content_type || p.mime_type)) {
                filesToFetch.push(fid);
              }
            }
          }
        }
      }

      if (filesToFetch.length > 0 && typeof fetch === "function") {
        await Promise.all(filesToFetch.map(fid => fetchChatGptFile(fid)));
      }

      function extractChatGptMessageContent(msg) {
        if (!msg || !msg.content) return "";
        const c = msg.content;
        const parts = [];
        const handledFiles = new Set();

        if (typeof c.text === "string" && c.text.trim()) {
          parts.push(c.text.trim());
        }

        if (Array.isArray(c.parts)) {
          for (const p of c.parts) {
            if (!p) continue;
            if (typeof p === "string") {
              if (p.trim()) parts.push(p.trim());
            } else if (typeof p === "object") {
              let fileId = null;
              if (typeof p.asset_pointer === "string" && p.asset_pointer.startsWith("file-service://")) {
                fileId = p.asset_pointer.replace("file-service://", "");
              } else if (typeof p.id === "string" && p.id.startsWith("file-")) {
                fileId = p.id;
              }

              if (fileId) {
                handledFiles.add(fileId);
                const name = p.name || "Pasted text";
                const cached = fileCache.get(fileId);
                if (cached && typeof cached === "string") {
                  parts.push(`📎 **[${name}]:**\n\`\`\`\n${cached.trim()}\n\`\`\``);
                } else if (p.content_type === "image_asset_pointer") {
                  parts.push(`[Image Attachment: ${name}]`);
                } else {
                  parts.push(`📎 **[Attachment: ${name}]**`);
                }
              } else if (typeof p.text === "string" && p.text.trim()) {
                parts.push(p.text.trim());
              } else if (typeof p.content === "string" && p.content.trim()) {
                parts.push(p.content.trim());
              } else if (p.content_type === "image_asset_pointer" || p.asset_pointer) {
                parts.push("[Image Attachment]");
              } else if (p.content_type === "audio_asset_pointer") {
                parts.push("[Audio Clip]");
              } else if (p.type === "text" && typeof p.text === "string") {
                parts.push(p.text.trim());
              }
            }
          }
        }

        // Include any metadata attachments not already listed in parts
        if (Array.isArray(msg.metadata?.attachments)) {
          for (const att of msg.metadata.attachments) {
            if (!att || !att.id || handledFiles.has(att.id)) continue;
            handledFiles.add(att.id);
            const name = att.name || "Pasted text";
            const cached = fileCache.get(att.id);
            if (cached && typeof cached === "string") {
              parts.push(`📎 **[${name}]:**\n\`\`\`\n${cached.trim()}\n\`\`\``);
            } else if (att.mime_type && att.mime_type.startsWith("image/")) {
              parts.push(`[Image Attachment: ${name}]`);
            } else {
              parts.push(`📎 **[Attachment: ${name}]**`);
            }
          }
        }

        if (c.content_type === "code" && typeof c.text === "string") {
          parts.push("```python\n" + c.text.trim() + "\n```");
        } else if (c.content_type === "execution_output" && typeof c.text === "string") {
          parts.push("> 📋 **Output:**\n```\n" + c.text.trim() + "\n```");
        } else if (c.content_type === "tether_browsing_display" || c.content_type === "tether_quote") {
          if (c.result) parts.push("> 🔍 " + c.result);
        }

        return parts.join("\n\n");
      }

      conv.messages = nodes.map(n => {
        const msg = n.message;
        if (!msg || !msg.author || msg.author.role === "system") return null;

        const isUser = msg.author.role === "user";
        const isTool = msg.author.role === "tool";
        let sender = "ChatGPT";
        if (isUser) sender = "User";
        else if (isTool) sender = msg.author.name ? `Tool (${msg.author.name})` : "Tool";
        else if (msg.author.name) sender = msg.author.name;

        const text = extractChatGptMessageContent(msg);
        const thoughts = clean(msg.metadata?.thought || msg.metadata?.reasoning || msg.metadata?.reasoning_content || "");

        if (!text && !thoughts) return null;

        return {
          role: isUser ? "user" : "assistant",
          sender: sender,
          text: clean(text),
          thoughts: thoughts,
          timestamp: msg.create_time ? msg.create_time * 1000 : null
        };
      }).filter(Boolean);
    }
  }

  // 3. DEEPSEEK (History API / R1 Reasoner Walk)
  else if (host.includes("deepseek.com")) {
    conv.platform = "DeepSeek";
    let raw = null;
    if (typeof performance !== "undefined") {
      const match = performance.getEntriesByType("resource").map(e => e.name).reverse().find(u => u.includes("/history_messages"));
      if (match) {
        try { const r = await fetch(match, { credentials: "include" }); if (r.ok) raw = await r.json(); } catch (_) {}
      }
    }
    if (raw && raw.data && Array.isArray(raw.data.chat_messages)) {
      conv.messages = raw.data.chat_messages.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        sender: m.role === "user" ? "User" : "DeepSeek",
        text: clean(m.content),
        thoughts: clean(m.thinking_content || "")
      })).filter(m => m.text || m.thoughts);
    } else {
      const els = Array.from(document.querySelectorAll(".chat-message, [class*='chat-message']"));
      conv.messages = els.map(el => {
        const isUser = el.className.includes("user") || el.getAttribute("data-role") === "user" || !!el.querySelector("[class*='user-avatar']");
        const thinkEl = el.querySelector(".ds-think, [class*='think']");
        const thoughts = thinkEl ? clean(thinkEl.innerText) : "";
        const clone = el.cloneNode(true);
        const cThink = clone.querySelector(".ds-think, [class*='think']");
        if (cThink) cThink.remove();
        const textEl = clone.querySelector(".ds-markdown, [class*='markdown']") || clone;
        return {
          role: isUser ? "user" : "assistant",
          sender: isUser ? "User" : "DeepSeek",
          text: clean(textEl.innerText),
          thoughts: thoughts
        };
      }).filter(m => m.text || m.thoughts);
    }
  }

  // 4. GLM / CHATGLM / Z.AI (chatglm.cn, z.ai, bigmodel.cn, glm.ai)
  else if (host.includes("chatglm.cn") || host.includes("z.ai") || host.includes("bigmodel.cn") || host.includes("glm.ai") || host.includes("zhipu")) {
    conv.platform = "GLM";

    // Check specific GLM question and answer DOM selectors
    const qSel = ".question-content-wrap, [class*='question-content'], [class*='question-wrap'], [class*='user-content'], [class*='user-msg'], [class*='my-message']";
    const aSel = ".answer-content-wrap, [class*='answer-content'], [class*='answer-wrap'], [class*='bot-content'], [class*='assistant-content'], [class*='bot-message']";
    
    const glmNodes = Array.from(document.querySelectorAll(`${qSel}, ${aSel}`));
    if (glmNodes.length > 0) {
      conv.messages = glmNodes.map(el => {
        const isUser = el.matches(qSel) || el.className.toLowerCase().includes("question") || el.className.toLowerCase().includes("user");
        const thinkEl = el.querySelector("[class*='think'], [class*='reason']");
        const thoughts = thinkEl ? clean(thinkEl.innerText) : "";
        const clone = el.cloneNode(true);
        const cThink = clone.querySelector("[class*='think'], [class*='reason']");
        if (cThink) cThink.remove();
        const text = clean(clone.innerText);
        return (text || thoughts) ? {
          role: isUser ? "user" : "assistant",
          sender: isUser ? "User" : "GLM",
          text: text,
          thoughts: thoughts
        } : null;
      }).filter(Boolean);
    }
  }

  // 5. GOOGLE AI STUDIO (aistudio.google.com)
  else if (host.includes("aistudio.google.com")) {
    conv.platform = "Google AI Studio";

    const container = document.querySelector("ms-autoscroll-container, [class*='autoscroll']");
    const collectedTurns = new Map();

    function harvestTurns() {
      // AI Studio turn hosts
      const turns = Array.from(document.querySelectorAll("ms-chat-turn, [data-turn-role], .chat-turn-container"));
      for (const turn of turns) {
        // Clone turn for manipulation
        const clone = turn.cloneNode(true);

        // 1. Separate model thinking / thoughts
        const thinkEl = clone.querySelector(".thought-container, [class*='thought'], [class*='think'], [class*='reason']");
        const thoughts = thinkEl ? clean(thinkEl.innerText) : "";
        if (thinkEl) thinkEl.remove();

        // 2. Identify if this turn is user or model
        const roleAttr = (turn.getAttribute("data-turn-role") || turn.getAttribute("data-role") || "").toLowerCase();
        const classStr = (turn.className || "").toLowerCase();
        const isUser = roleAttr.includes("user") || classStr.includes("user") ||
                       !!turn.querySelector(".user-prompt-container, .chat-turn-container.user, [data-turn-role='User'], .render.user");

        let text = "";

        // 3. Extract text according to role
        if (isUser) {
          const userPromptEl = clone.querySelector ? clone.querySelector(".user-prompt-container, [class*='user-prompt']") : null;
          const targetEl = (userPromptEl && typeof userPromptEl.querySelectorAll === "function") ? userPromptEl : clone;

          const textareas = (targetEl.querySelectorAll ? Array.from(targetEl.querySelectorAll("textarea")) : []);
          if (textareas.length > 0) {
            text = textareas.map(t => t.value || t.innerText || "").filter(Boolean).join("\n\n").trim();
          }

          if (!text && targetEl.querySelector) {
            const chunkEl = targetEl.querySelector("ms-text-chunk, [class*='text-chunk'], ms-cmark-node, .cmark-node");
            if (chunkEl) {
              text = chunkEl.innerText ? chunkEl.innerText.trim() : "";
            }
          }

          if (!text) {
            text = targetEl.innerText ? targetEl.innerText.trim() : "";
          }

          const chips = (turn.querySelectorAll ? Array.from(turn.querySelectorAll("mat-chip, [class*='chip'], [class*='pill'], [class*='attachment'], [class*='file-token']")) : []);
          if (chips.length > 0) {
            const chipTexts = chips.map(c => `📎 [Pasted Attachment / File: ${clean(c.innerText)}]`).filter(Boolean).join("\n");
            text = text ? `${text}\n\n${chipTexts}` : chipTexts;
          }
        } else {
          const textareas = (clone.querySelectorAll ? Array.from(clone.querySelectorAll("textarea")) : []);
          if (textareas.length > 0) {
            text = textareas.map(t => t.value || t.innerText || "").filter(Boolean).join("\n\n").trim();
          }
          if (!text) {
            text = clone.innerText ? clone.innerText.trim() : "";
          }
        }

        // 4. Clean UI artifacts (more_vert, edit, timestamps like User 2:21 PM)
        let cleanBody = text
          .replace(/^(edit\s*|more_vert\s*)+/g, "")
          .replace(/^(User|Model)\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\s*/gi, "")
          .replace(/^(edit\s*|more_vert\s*)+/g, "")
          .trim();

        if (cleanBody || thoughts) {
          const key = (isUser ? "u_" : "a_") + cleanBody.slice(0, 120) + "___" + thoughts.slice(0, 40);
          if (!collectedTurns.has(key)) {
            collectedTurns.set(key, {
              role: isUser ? "user" : "assistant",
              sender: isUser ? "User" : "Gemini",
              text: cleanBody,
              thoughts: thoughts
            });
          }
        }
      }
    }

    harvestTurns();

    // Fast-sweep virtual-scroll container if tall
    if (container && container.scrollHeight > container.clientHeight * 1.5) {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const totalHeight = container.scrollHeight;
      const step = Math.max(container.clientHeight * 1.5, 1200);
      const origScroll = container.scrollTop;

      // Sweep from top to bottom
      container.scrollTop = 0;
      await sleep(40);
      harvestTurns();

      for (let pos = step; pos <= totalHeight + step; pos += step) {
        container.scrollTop = pos;
        await sleep(35);
        harvestTurns();
      }

      // Restore original scroll position
      container.scrollTop = origScroll;
    }

    if (collectedTurns.size > 0) {
      conv.messages = Array.from(collectedTurns.values());
    }
  }

  // 6. UNIVERSAL MULTI-STAGE DOM RECOVERY (Works on ANY AI chat platform)
  if (!conv.messages || conv.messages.length === 0) {
    // Stage A: High-confidence conversational turn containers
    const turnSelectors = [
      "ms-chat-turn",
      "ms-prompt-chunk",
      "conversation-turn",
      "article",
      "[data-role]",
      "[data-turn-role]",
      "[data-message-author-role]",
      "[data-testid*='message']",
      "[data-testid*='chat']",
      "[class*='message-row']",
      "[class*='chat-item']",
      "[class*='message-item']",
      "[class*='chat-message']",
      "[class*='message-bubble']",
      "[class*='question-content']",
      "[class*='answer-content']",
      "[class*='dialogue']",
      "[class*='chat-content']",
      "[class*='talk-bubble']",
      ".chat-item",
      ".message-item",
      ".question-content-wrap",
      ".answer-content-wrap"
    ].join(", ");

    let turns = Array.from(document.querySelectorAll(turnSelectors));
    // Filter out parent elements that contain matched child turns
    turns = turns.filter(el => !turns.some(other => other !== el && el.contains(other)));

    if (turns.length > 0) {
      conv.messages = turns.map(turn => {
        const roleAttr = (turn.getAttribute("data-turn-role") || turn.getAttribute("data-role") || turn.getAttribute("data-message-author-role") || turn.getAttribute("data-author") || "").toLowerCase();
        const classStr = turn.className.toLowerCase();
        const isUser = roleAttr.includes("user") || roleAttr.includes("human") ||
                       classStr.includes("user") || classStr.includes("human") || classStr.includes("question") || classStr.includes("prompt") ||
                       !!turn.querySelector("[class*='user'], [class*='human'], [class*='question'], [data-turn-role='User'], textarea");

        const thinkEl = turn.querySelector(".ds-think, [class*='think'], [class*='reason'], [class*='thought']");
        const thoughts = thinkEl ? clean(thinkEl.innerText) : "";

        const clone = turn.cloneNode(true);
        const cThink = clone.querySelector(".ds-think, [class*='think'], [class*='reason'], [class*='thought']");
        if (cThink) cThink.remove();

        // Extract text from textareas or contenteditables if present, otherwise innerText
        let text = "";
        const textareas = Array.from(clone.querySelectorAll("textarea"));
        if (textareas.length > 0) {
          text = clean(textareas.map(t => t.value || t.innerText || "").filter(Boolean).join("\n\n"));
        }
        if (!text) {
          const editables = Array.from(clone.querySelectorAll("[contenteditable='true']"));
          if (editables.length > 0) {
            text = clean(editables.map(ed => ed.innerText || "").filter(Boolean).join("\n\n"));
          }
        }
        if (!text) {
          text = clean(clone.innerText);
        }

        return (text || thoughts) ? {
          role: isUser ? "user" : "assistant",
          sender: isUser ? "User" : (conv.platform || "Assistant"),
          text: text,
          thoughts: thoughts
        } : null;
      }).filter(Boolean);
    }
  }

  // Stage B: Markdown & Prose Block Harvesting
  if (!conv.messages || conv.messages.length === 0) {
    const markdownBlocks = Array.from(document.querySelectorAll(".markdown-body, .prose, [class*='markdown'], [class*='answer'], [class*='bubble'], .text-message"));
    if (markdownBlocks.length > 0) {
      conv.messages = markdownBlocks.map((block, idx) => {
        const text = clean(block.innerText);
        const isUser = block.className.toLowerCase().includes("user") || block.className.toLowerCase().includes("question");
        return text ? {
          role: isUser ? "user" : "assistant",
          sender: isUser ? "User" : (conv.platform || "Assistant"),
          text: text
        } : null;
      }).filter(Boolean);
    }
  }

  // Stage C: Main Chat Scroll Container Child Walker (The Ultimate Fail-Safe)
  if (!conv.messages || conv.messages.length === 0) {
    const candidates = Array.from(document.querySelectorAll("main, [role='main'], [class*='chat'], [class*='conversation'], [class*='history'], [class*='message']"));
    let bestContainer = null;
    let maxValidChildren = 0;

    for (const c of candidates) {
      const directChildren = Array.from(c.children);
      const textChildren = directChildren.filter(child => clean(child.innerText).length > 5);
      if (textChildren.length >= 2 && textChildren.length > maxValidChildren) {
        maxValidChildren = textChildren.length;
        bestContainer = c;
      }
    }

    if (bestContainer) {
      const items = Array.from(bestContainer.children).filter(child => clean(child.innerText).length > 5);
      conv.messages = items.map((item, idx) => {
        const text = clean(item.innerText);
        const isUser = item.className.toLowerCase().includes("user") || item.className.toLowerCase().includes("right") ||
                       !!item.querySelector("[class*='user'], [class*='avatar-user'], img[alt*='user' i]");
        return text ? {
          role: isUser ? "user" : "assistant",
          sender: isUser ? "User" : (conv.platform || "Assistant"),
          text: text
        } : null;
      }).filter(Boolean);
    }
  }

  if (!conv.messages || conv.messages.length === 0) {
    console.error("❌ Could not detect messages on this page. Make sure you are viewing an active conversation.");
    return;
  }

  // CALCULATE TOKEN COMPRESSION STATS
  let origAll = "";
  let compAll = "";
  let handoverPrompt = `> **[Prior Context: ${conv.title}]**\n> _Cleaned & Token-Compressed for AI Handover_\n\n`;

  let rawMd = `# ${conv.title}\n\n**Platform:** ${conv.platform}  \n**Total Messages:** ${conv.messages.length}\n\n---\n\n`;

  for (const m of conv.messages) {
    origAll += (m.thoughts || "") + "\n" + (m.text || "") + "\n";
    const cleanedText = m.role === "assistant" ? stripFiller(m.text) : m.text;
    compAll += cleanedText + "\n";

    // Build handover prompt
    handoverPrompt += `### ${m.role === "user" ? "👤 User" : "🤖 " + m.sender}\n\n${cleanedText}\n\n---\n\n`;

    // Build raw markdown
    rawMd += `## ${m.sender}\n\n`;
    if (m.thoughts) rawMd += `<details>\n<summary>💭 <i>Thinking Process</i></summary>\n\n> ${m.thoughts.replace(/\n/g, "\n> ")}\n\n</details>\n\n`;
    if (m.text) rawMd += `${m.text}\n\n`;
    rawMd += `---\n\n`;
  }

  handoverPrompt += `**[Task Continuation Prompt]**: Please review the above conversation history and continue assisting based on the technical decisions established above.`;

  const origTokens = estimateTokens(origAll);
  const compTokens = estimateTokens(compAll);
  const savedPercent = origTokens > 0 ? Math.round(((origTokens - compTokens) / origTokens) * 100) : 0;

  // Copy compressed prompt to clipboard
  try {
    await navigator.clipboard.writeText(handoverPrompt);
    console.log(`%c📋 COPIED COMPRESSED CONTEXT TO CLIPBOARD!`, "color: #a855f7; font-weight: bold; font-size: 13px;");
    console.log(`%c⚡ Original Tokens: ~${origTokens.toLocaleString()} | Compressed: ~${compTokens.toLocaleString()} (Saved ${savedPercent}% tokens!)`, "color: #22c55e; font-weight: bold;");
  } catch (_) {}

  // Download raw markdown file
  const safeTitle = (conv.title || "ai_chat").replace(/[<>:"/\\|?*]+/g, "_").replace(/\s+/g, "_").slice(0, 80);
  download(rawMd, `${safeTitle}.md`, "text/markdown");
  console.log(`%c💾 Downloaded full raw markdown to "${safeTitle}.md"!`, "color: #38bdf8; font-size: 12px;");
})();
