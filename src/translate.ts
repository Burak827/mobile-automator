export type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function requestOpenAI(options: {
  config: OpenAIConfig;
  messages: OpenAIMessage[];
  temperature?: number;
}): Promise<string> {
  const { config, messages } = options;
  const baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");

  const payload = {
    model: config.model,
    messages,
    temperature: options.temperature ?? 0.2,
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  if (!response.ok) {
    let message = `OpenAI request failed (${response.status} ${response.statusText})`;
    if (raw) {
      try {
        const errorPayload = JSON.parse(raw);
        const detail = errorPayload?.error?.message ?? raw;
        message = `${message}: ${detail}`;
      } catch {
        message = `${message}: ${raw}`;
      }
    }
    const error = new Error(message) as Error & {
      status?: number;
      retryAfterMs?: number;
    };
    error.status = response.status;
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const retryAfterSeconds = Number(retryAfter);
      if (Number.isFinite(retryAfterSeconds)) {
        error.retryAfterMs = retryAfterSeconds * 1000;
      }
    }
    throw error;
  }

  const data = raw ? JSON.parse(raw) : null;
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI response missing translated content.");
  }

  return content.trim();
}

export async function translateWithOpenAI(options: {
  config: OpenAIConfig;
  sourceLocale: string;
  targetLocale: string;
  text: string;
  fieldName?: string;
  maxLength?: number;
}): Promise<string> {
  const { config, sourceLocale, targetLocale, text, fieldName, maxLength } = options;
  const fieldHint = fieldName ? ` for the App Store ${fieldName}` : "";
  const lengthHint =
    typeof maxLength === "number" && Number.isFinite(maxLength)
      ? ` The translation must be ${Math.floor(maxLength)} characters or fewer.`
      : "";

  return requestOpenAI({
    config,
    messages: [
      {
        role: "system",
        content:
          "You are a translation engine for App Store listing text. " +
          "Translate accurately, keep line breaks and formatting, and return only the translated text.",
      },
      {
        role: "user",
        content: `Translate${fieldHint} from ${sourceLocale} to ${targetLocale}.${lengthHint} Return only the translated text.\n\n${text}`,
      },
    ],
  });
}

export async function shortenWithOpenAI(options: {
  config: OpenAIConfig;
  targetLocale: string;
  text: string;
  fieldName?: string;
  maxLength: number;
}): Promise<string> {
  const { config, targetLocale, text, fieldName, maxLength } = options;
  const fieldHint = fieldName ? ` for the App Store ${fieldName}` : "";
  const limit = Math.floor(maxLength);

  return requestOpenAI({
    config,
    messages: [
      {
        role: "system",
        content:
          "You are a rewriting engine for App Store listing text. " +
          "Shorten while preserving meaning, tone, and formatting. Do not add new info. Return only the shortened text.",
      },
      {
        role: "user",
        content:
          `Shorten${fieldHint} in ${targetLocale} to ${limit} characters or fewer. ` +
          "Keep line breaks and formatting. Return only the shortened text.\n\n" +
          text,
      },
    ],
    temperature: 0.2,
  });
}
