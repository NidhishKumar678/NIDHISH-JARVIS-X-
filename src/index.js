
const MODEL = "@cf/google/gemma-4-26b-a4b-it";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}

function cleanText(value, maxLength = 6000) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

const SYSTEM_PROMPT = `
You are NIDHISH JARVIS X, an intelligent AI assistant created by
Nidhish Kumar.

Your responsibilities:
- Answer questions clearly and accurately.
- Explain difficult topics in simple language.
- Help with science, mathematics, coding and technology.
- Assist with writing, planning and problem solving.
- Be professional, friendly and conversational.
- Admit uncertainty instead of inventing facts.
- Never claim to have searched the internet unless a search tool
  was actually used.
- Never claim to have performed an action you did not perform.
- Protect user privacy and never request passwords or secret keys.
- Keep answers relevant and well structured.
`;

async function handleChat(request, env) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return json({
      success: false,
      error: "Workers AI binding is unavailable."
    }, 503);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      success: false,
      error: "Invalid JSON request."
    }, 400);
  }

  const message = cleanText(body.message);

  if (!message) {
    return json({
      success: false,
      error: "Please enter a message."
    }, 400);
  }

  const history = Array.isArray(body.history)
    ? body.history.slice(-10)
    : [];

  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    }
  ];

  for (const item of history) {
    if (
      item &&
      ["user", "assistant"].includes(item.role) &&
      typeof item.content === "string"
    ) {
      messages.push({
        role: item.role,
        content: cleanText(item.content, 3000)
      });
    }
  }

  messages.push({
    role: "user",
    content: message
  });

  try {
    const result = await env.AI.run(MODEL, {
      messages,
      max_tokens: 900,
      temperature: 0.6,
      chat_template_kwargs: {
        enable_thinking: false
      }
    });

    const answer =
      result?.response ??
      result?.choices?.[0]?.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      return json({
        success: false,
        error: "The AI returned an empty response."
      }, 502);
    }

    return json({
      success: true,
      assistant: "NIDHISH JARVIS X",
      model: MODEL,
      reply: answer.trim()
    });

  } catch {
    return json({
      success: false,
      error: "AI request failed.",
      message: "Check Workers AI configuration and try again."
    }, 502);
  }
}

function checkSpam(message) {
  const text = cleanText(message, 5000).toLowerCase();

  const suspiciousPatterns = [
    /guaranteed\s+(prize|reward|money)/,
    /share\s+your\s+(password|otp|pin)/,
    /urgent.*click.*link/,
    /claim\s+your\s+(free|cash)\s+(prize|reward)/,
    /send\s+otp/
  ];

  const matched = suspiciousPatterns.some(pattern =>
    pattern.test(text)
  );

  return {
    success: true,
    suspicious: matched,
    risk: matched ? "high" : "unknown",
    explanation: matched
      ? "This message contains suspicious wording. Verify the sender independently."
      : "No listed suspicious pattern was detected. This does not prove the message is safe.",
    disclaimer: "This is a basic text-pattern check, not a complete scam detector."
  };
}

async function handleSpamCheck(request) {
  try {
    const body = await request.json();
    const message = cleanText(body.message, 5000);

    if (!message) {
      return json({
        success: false,
        error: "Please provide a message."
      }, 400);
    }

    return json(checkSpam(message));

  } catch {
    return json({
      success: false,
      error: "Invalid JSON request."
    }, 400);
  }
}

async function handleVideoPlan(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      success: false,
      error: "Invalid JSON request."
    }, 400);
  }

  const prompt = cleanText(
    body.prompt || body.message || body.topic,
    4000
  );

  if (!prompt) {
    return json({
      success: false,
      error: "Please describe the video you want."
    }, 400);
  }

  if (!env.AI || typeof env.AI.run !== "function") {
    return json({
      success: false,
      error: "Workers AI binding is unavailable."
    }, 503);
  }

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content: `You are the video planning assistant for NIDHISH JARVIS X.
Create a practical video production plan.
Include:
1. Video title
2. Concept
3. Scene-by-scene storyboard
4. Visual descriptions
5. Narration suggestions
6. Background music suggestions
7. Editing instructions
Do not claim to generate or render an actual video.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
      chat_template_kwargs: {
        enable_thinking: false
      }
    });

    const plan =
      result?.response ??
      result?.choices?.[0]?.message?.content;

    if (typeof plan !== "string" || !plan.trim()) {
      return json({
        success: false,
        error: "Unable to create video plan."
      }, 502);
    }

    return json({
      success: true,
      status: "plan_created",
      message: plan.trim(),
      plan: plan.trim(),
      video_generated: false
    });

  } catch {
    return json({
      success: false,
      error: "Video planning request failed."
    }, 502);
  }
}

async function handleSearch(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({
      success: false,
      error: "Invalid JSON request."
    }, 400);
  }

  const query = cleanText(
    body.query || body.message,
    2000
  );

  if (!query) {
    return json({
      success: false,
      error: "Please enter a search query."
    }, 400);
  }

  return json({
    success: false,
    status: "not_configured",
    query,
    message: "Live web research is not configured yet. Connect a search provider to enable this feature."
  }, 501);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    if (request.method === "GET" && path === "/") {
      return json({
        name: "NIDHISH JARVIS X",
        creator: "Nidhish Kumar",
        status: "online",
        version: "2.1.0",
        message: "Jarvis X backend is running."
      });
    }

    if (request.method === "GET" && path === "/health") {
      return json({
        status: "healthy",
        backend: "NIDHISH JARVIS X",
        version: "2.1.0",
        ai_binding: Boolean(env.AI),
        endpoints: {
          chat: "/api/chat",
          search: "/api/search",
          spam_check: "/api/spam-check",
          video_plan: "/api/video-plan"
        }
      });
    }

    if (path === "/api/health") {
      if (request.method !== "GET") {
        return json({
          success: false,
          error: "GET method required."
        }, 405);
      }

      return json({
        success: true,
        status: "healthy",
        backend: "NIDHISH JARVIS X",
        ai_binding: Boolean(env.AI)
      });
    }

    if (path === "/api/chat") {
      if (request.method !== "POST") {
        return json({
          success: false,
          error: "POST method required."
        }, 405);
      }

      return handleChat(request, env);
    }

    if (path === "/api/spam-check") {
      if (request.method !== "POST") {
        return json({
          success: false,
          error: "POST method required."
        }, 405);
      }

      return handleSpamCheck(request);
    }

    if (path === "/api/search") {
      if (request.method !== "POST") {
        return json({
          success: false,
          error: "POST method required."
        }, 405);
      }

      return handleSearch(request);
    }

    if (path === "/api/video-plan") {
      if (request.method !== "POST") {
        return json({
          success: false,
          error: "POST method required."
        }, 405);
      }

      return handleVideoPlan(request, env);
    }

    if (path === "/api/video") {
      return json({
        success: false,
        status: "not_configured",
        message: "Actual video generation requires a video-generation provider."
      }, 501);
    }

    return json({
      success: false,
      error: "Route not found.",
      name: "NIDHISH JARVIS X"
    }, 404);
  }
};
