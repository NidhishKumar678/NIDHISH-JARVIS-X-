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
- Never claim to have performed an action you did not perform.
- Never claim to have searched the internet unless a search tool
  was actually used.
- Protect user privacy and do not request passwords or secret keys.
- Keep answers relevant and well structured.
`;

async function handleChat(request, env) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return json({
      success: false,
      error: "Workers AI binding is unavailable.",
      solution: "Check that the AI binding is named AI."
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

  if (message.length > 6000) {
    return json({
      success: false,
      error: "Message is too long."
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

  } catch (error) {
    return json({
      success: false,
      error: "AI request failed.",
      message: "Please check your Workers AI configuration and try again."
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
        version: "2.0.0",
        message: "Jarvis X backend is running."
      });
    }

    if (request.method === "GET" && path === "/health") {
      return json({
        status: "healthy",
        backend: "NIDHISH JARVIS X",
        ai_binding: Boolean(env.AI),
        chat_endpoint: "/api/chat"
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

    if (path === "/api/search" || path === "/api/video") {
      return json({
        success: false,
        status: "not_configured",
        service: path,
        message: "This service requires a separate provider integration."
      }, 501);
    }

    return json({
      success: false,
      error: "Route not found.",
      name: "NIDHISH JARVIS X"
    }, 404);
  }
};
