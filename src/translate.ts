export type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";

function supportsCustomTemperature(model: string): boolean {
  return !model.trim().toLowerCase().startsWith("gpt-5");
}

async function requestOpenAI(options: {
  config: OpenAIConfig;
  messages: OpenAIMessage[];
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
}): Promise<string> {
  const { config, messages } = options;
  const baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const preferredTemperature = options.temperature ?? 0.2;
  const basePayload = {
    model: config.model,
    messages,
    reasoning_effort: options.reasoningEffort ?? "xhigh",
  };
  const payload = supportsCustomTemperature(config.model)
    ? { ...basePayload, temperature: preferredTemperature }
    : basePayload;

  const runRequest = async (requestPayload: Record<string, unknown>) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

  let response = await runRequest(payload);
  let raw = await response.text();

  // Safety fallback: if backend/model rejects temperature, retry once without it.
  if (
    !response.ok &&
    response.status === 400 &&
    Object.prototype.hasOwnProperty.call(payload, "temperature") &&
    raw.includes("Unsupported value: 'temperature'")
  ) {
    response = await runRequest(basePayload);
    raw = await response.text();
  }

  if (!response.ok) {
    let detail = raw;
    if (raw) {
      try {
        const errorPayload = JSON.parse(raw);
        detail = errorPayload?.error?.message ?? raw;
      } catch {
        detail = raw;
      }
    }
    const message = `OpenAI request failed (${response.status} ${response.statusText}): ${detail}`;
    const error = new Error(message) as Error & { status?: number; retryAfterMs?: number };
    error.status = response.status;
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const retryAfterSeconds = Number(retryAfter);
      if (Number.isFinite(retryAfterSeconds)) error.retryAfterMs = retryAfterSeconds * 1000;
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
  lengthUnit?: "characters" | "bytes";
  storeName?: string;
  appTitle?: string;
  masterPrompt?: string;
}): Promise<string> {
  const { config, sourceLocale, targetLocale, text, fieldName, maxLength } = options;
  const lengthUnit = options.lengthUnit ?? "characters";
  const store = options.storeName ?? "App Store";
  const fieldHint = fieldName ? ` for the ${store} ${fieldName}` : "";
  const lengthHint =
    typeof maxLength === "number" && Number.isFinite(maxLength)
      ? ` The translation must be ${Math.floor(maxLength)} ${lengthUnit} or fewer.`
      : "";
  const titleContext = options.appTitle
    ? ` The app is called "${options.appTitle}" in this locale.`
    : "";
  const masterHint = options.masterPrompt
    ? ` Additional instructions: ${options.masterPrompt}`
    : "";

  return requestOpenAI({
    config,
    messages: [
      {
        role: "system",
        content:
          `You are a translation engine for ${store} listing text. ` +
          "Translate accurately, keep line breaks and formatting, and return only the translated text." +
          masterHint,
      },
      {
        role: "user",
        content: `Translate${fieldHint} from ${sourceLocale} to ${targetLocale}.${lengthHint}${titleContext} Return only the translated text.\n\n${text}`,
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
  lengthUnit?: "characters" | "bytes";
  storeName?: string;
  masterPrompt?: string;
}): Promise<string> {
  const { config, targetLocale, text, fieldName, maxLength } = options;
  const lengthUnit = options.lengthUnit ?? "characters";
  const store = options.storeName ?? "App Store";
  const fieldHint = fieldName ? ` for the ${store} ${fieldName}` : "";
  const limit = Math.floor(maxLength);
  const masterHint = options.masterPrompt
    ? ` Additional instructions: ${options.masterPrompt}`
    : "";

  return requestOpenAI({
    config,
    messages: [
      {
        role: "system",
        content:
          `You are a rewriting engine for ${store} listing text. ` +
          "Shorten while preserving meaning, tone, and formatting. Do not add new info. Return only the shortened text." +
          masterHint,
      },
      {
        role: "user",
        content:
          `Shorten${fieldHint} in ${targetLocale} to ${limit} ${lengthUnit} or fewer. ` +
          "Keep line breaks and formatting. Return only the shortened text.\n\n" +
          text,
      },
    ],
    temperature: 0.2,
  });
}

function normalizeVerifyAnswer(raw: string): "evet" | "hayir" | null {
  const firstToken = raw
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^\p{L}]/gu, "") ?? "";

  if (!firstToken) return null;
  if (firstToken === "evet" || firstToken === "yes" || firstToken === "y") return "evet";
  if (
    firstToken === "hayir" ||
    firstToken === "hayır" ||
    firstToken === "no" ||
    firstToken === "n"
  ) {
    return "hayir";
  }
  return null;
}

export async function verifyTranslationWithOpenAI(options: {
  config: OpenAIConfig;
  sourceLocale: string;
  targetLocale: string;
  sourceText: string;
  translatedText: string;
  fieldName?: string;
  storeName?: string;
  appTitle?: string;
  masterPrompt?: string;
}): Promise<{
  verdict: "evet" | "hayir";
  raw: string;
}> {
  const store = options.storeName ?? "App Store";
  const fieldHint = options.fieldName ? ` (${options.fieldName})` : "";
  const titleContext = options.appTitle
    ? `Uygulama adı hedef locale'de "${options.appTitle}".`
    : "";
  const masterHint = options.masterPrompt
    ? ` Ek talimat: ${options.masterPrompt}`
    : "";

  const raw = await requestOpenAI({
    config: options.config,
    messages: [
      {
        role: "system",
        content:
          "You are a strict translation quality checker for app store listing text. " +
          "You must answer with only one word: evet or hayir. " +
          "Do not add any explanation, punctuation, or extra tokens." +
          masterHint,
      },
      {
        role: "user",
        content:
          `Kaynak dil: ${options.sourceLocale}. Hedef dil: ${options.targetLocale}. Store: ${store}${fieldHint}. ` +
          `${titleContext} ` +
          "Aşağıdaki çeviri, kaynak metnin iyi ve anlamı koruyan bir çevirisi mi? " +
          "Sadece evet veya hayir cevabı ver.\n\n" +
          `Kaynak metin:\n${options.sourceText}\n\n` +
          `Çevrilmiş metin:\n${options.translatedText}`,
      },
    ],
    temperature: 0,
  });

  const verdict = normalizeVerifyAnswer(raw);
  if (!verdict) {
    throw new Error(`Verify yanıtı geçersiz: "${raw}"`);
  }

  return { verdict, raw };
}
