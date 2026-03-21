export type AIProvider = "openai" | "anthropic";

type BaseAIConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

export type OpenAIConfig = BaseAIConfig & {
  provider?: "openai";
};

export type AnthropicConfig = BaseAIConfig & {
  provider: "anthropic";
  version?: string;
};

export type AIConfig = OpenAIConfig | AnthropicConfig;

export type OpenAIBatchField = {
  key: string;
  text: string;
  maxLength?: number;
  lengthUnit?: "characters" | "bytes";
};

function isAppTitleField(key?: string): boolean {
  return key === "title" || key === "appName";
}

function buildMasterInstruction(masterPrompt?: string): string {
  if (!masterPrompt?.trim()) return "";
  return (
    " High-priority user instructions override default assumptions about branding, naming, and style." +
    ` Follow these instructions exactly: ${masterPrompt.trim()}`
  );
}

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
    let errorPayload: Record<string, unknown> | null = null;
    if (raw) {
      try {
        errorPayload = JSON.parse(raw) as Record<string, unknown>;
        const parsedError = (errorPayload.error ?? null) as Record<string, unknown> | null;
        detail = typeof parsedError?.message === "string" ? parsedError.message : raw;
      } catch {
        detail = raw;
      }
    }
    const message = `OpenAI request failed (${response.status} ${response.statusText}): ${detail}`;
    const error = new Error(message) as Error & {
      status?: number;
      retryAfterMs?: number;
      isRetryable?: boolean;
      isQuotaExceeded?: boolean;
      openaiErrorCode?: string;
      openaiErrorType?: string;
    };
    error.status = response.status;
    const openaiError = (errorPayload?.error ?? null) as Record<string, unknown> | null;
    const openaiErrorCode =
      typeof openaiError?.code === "string" ? openaiError.code : undefined;
    const openaiErrorType =
      typeof openaiError?.type === "string" ? openaiError.type : undefined;
    const detailLower = detail.toLowerCase();
    const isQuotaExceeded =
      response.status === 429 &&
      (
        openaiErrorCode === "insufficient_quota" ||
        openaiErrorType === "insufficient_quota" ||
        detailLower.includes("exceeded your current quota")
      );
    error.isQuotaExceeded = isQuotaExceeded;
    error.isRetryable = response.status === 429 && !isQuotaExceeded;
    error.openaiErrorCode = openaiErrorCode;
    error.openaiErrorType = openaiErrorType;
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

async function requestAnthropic(options: {
  config: AnthropicConfig;
  messages: OpenAIMessage[];
  temperature?: number;
}): Promise<string> {
  const { config, messages } = options;
  const baseUrl = (config.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter((message) => message.length > 0)
    .join("\n\n");
  const nonSystemMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": config.version ?? "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      temperature: options.temperature ?? 0.2,
      ...(system ? { system } : {}),
      messages: nonSystemMessages,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    let detail = raw;
    let errorPayload: Record<string, unknown> | null = null;
    if (raw) {
      try {
        errorPayload = JSON.parse(raw) as Record<string, unknown>;
        const parsedError = (errorPayload.error ?? null) as Record<string, unknown> | null;
        detail = typeof parsedError?.message === "string" ? parsedError.message : raw;
      } catch {
        detail = raw;
      }
    }

    const message = `Anthropic request failed (${response.status} ${response.statusText}): ${detail}`;
    const error = new Error(message) as Error & {
      status?: number;
      retryAfterMs?: number;
      isRetryable?: boolean;
      isQuotaExceeded?: boolean;
      anthropicErrorType?: string;
    };
    error.status = response.status;
    const anthropicError = (errorPayload?.error ?? null) as Record<string, unknown> | null;
    const anthropicErrorType =
      typeof anthropicError?.type === "string" ? anthropicError.type : undefined;
    const detailLower = detail.toLowerCase();
    const isQuotaExceeded =
      response.status === 429 &&
      (
        detailLower.includes("credit balance") ||
        detailLower.includes("spend limit") ||
        detailLower.includes("quota")
      );
    error.isQuotaExceeded = isQuotaExceeded;
    error.isRetryable = response.status === 429 && !isQuotaExceeded;
    error.anthropicErrorType = anthropicErrorType;
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const retryAfterSeconds = Number(retryAfter);
      if (Number.isFinite(retryAfterSeconds)) error.retryAfterMs = retryAfterSeconds * 1000;
    }
    throw error;
  }

  const data = raw ? JSON.parse(raw) : null;
  const contentBlocks: unknown[] = Array.isArray(data?.content) ? data.content : [];
  const text = contentBlocks
    .filter(
      (block): block is { type: string; text: string } =>
        Boolean(block) &&
        typeof block === "object" &&
        typeof (block as { type?: unknown }).type === "string" &&
        typeof (block as { text?: unknown }).text === "string"
    )
    .filter((block) => block.type === "text")
    .map((block) => block.text.trim())
    .filter((block) => block.length > 0)
    .join("\n");

  if (!text) {
    throw new Error("Anthropic response missing translated content.");
  }

  return text.trim();
}

async function requestAI(options: {
  config: AIConfig;
  messages: OpenAIMessage[];
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
}): Promise<string> {
  if (options.config.provider === "anthropic") {
    return requestAnthropic({
      config: options.config,
      messages: options.messages,
      temperature: options.temperature,
    });
  }

  return requestOpenAI({
    config: options.config,
    messages: options.messages,
    temperature: options.temperature,
    reasoningEffort: options.reasoningEffort,
  });
}

function parseJsonObjectResponse(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const candidates = new Set<string>();
  if (trimmed) candidates.add(trimmed);

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
  if (fenced?.trim()) {
    candidates.add(fenced.trim());
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.add(trimmed.slice(objectStart, objectEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("OpenAI response missing valid JSON object.");
}

export async function translateWithOpenAI(options: {
  config: AIConfig;
  sourceLocale: string;
  targetLocale: string;
  text: string;
  fieldName?: string;
  maxLength?: number;
  lengthUnit?: "characters" | "bytes";
  storeName?: string;
  appTitle?: string;
  masterPrompt?: string;
  /** Extra context added to the system prompt (e.g. screenshot marketing context). */
  contextHint?: string;
}): Promise<string> {
  const { config, sourceLocale, targetLocale, text, fieldName, maxLength } = options;
  const lengthUnit = options.lengthUnit ?? "characters";
  const store = options.storeName ?? "App Store";
  const fieldHint = fieldName ? ` for the ${store} ${fieldName}` : "";
  const lengthHint =
    typeof maxLength === "number" && Number.isFinite(maxLength)
      ? ` The translation must be ${Math.floor(maxLength)} ${lengthUnit} or fewer.`
      : "";
  const titleFieldHint = isAppTitleField(fieldName)
    ? " This field is the app title. Do not automatically keep the source wording unchanged. If the name is descriptive and not a fixed brand token, localize/adapt it naturally for the target language and culture."
    : "";
  const titleContext = options.appTitle
    ? ` The established localized app title for this locale is "${options.appTitle}". When the text refers to the app, use this localized title naturally.`
    : "";
  const masterHint = buildMasterInstruction(options.masterPrompt);
  const contextHint = options.contextHint ? ` ${options.contextHint}` : "";

  return requestAI({
    config,
    messages: [
      {
        role: "system",
        content:
          `You are a translation engine for ${store} listing text. ` +
          "Translate accurately, keep line breaks and formatting, and return only the translated text. " +
          "Do not automatically preserve source app titles or names. " +
          "If a title is descriptive and can be localized for the target market, translate/adapt it naturally. " +
          "Preserve only clear non-translatable brand tokens or proprietary spellings." +
          contextHint +
          masterHint,
      },
      {
        role: "user",
        content: `Translate${fieldHint} from ${sourceLocale} to ${targetLocale}.${lengthHint}${titleFieldHint}${titleContext} Return only the translated text.\n\n${text}`,
      },
    ],
  });
}

export async function translateBatchWithOpenAI(options: {
  config: AIConfig;
  sourceLocale: string;
  targetLocale: string;
  fields: OpenAIBatchField[];
  storeName?: string;
  appTitle?: string;
  masterPrompt?: string;
}): Promise<Record<string, string>> {
  const store = options.storeName ?? "App Store";
  const titleKeys = options.fields
    .map((field) => field.key)
    .filter((key) => isAppTitleField(key));
  const titleContext = options.appTitle
    ? ` Use "${options.appTitle}" as the established localized app title in this locale when the text refers to the app. Include it where natural, but do not force it into every sentence.`
    : "";
  const titleInstruction = titleKeys.length > 0
    ? ` The app title field(s) in this batch are: ${titleKeys.join(", ")}. Do not automatically preserve their source wording. If the title is descriptive rather than a fixed brand token, localize/adapt it naturally for the target language and culture, then keep the other fields consistent with that localized title.`
    : "";
  const masterHint = buildMasterInstruction(options.masterPrompt);

  const payload = {
    sourceLocale: options.sourceLocale,
    targetLocale: options.targetLocale,
    fields: options.fields.map((field) => ({
      key: field.key,
      role: isAppTitleField(field.key) ? "app_title" : "listing_text",
      maxLength: field.maxLength,
      lengthUnit: field.lengthUnit ?? "characters",
      text: field.text,
    })),
  };

  const raw = await requestAI({
    config: options.config,
    messages: [
      {
        role: "system",
        content:
          `You are a translation engine for ${store} listing text. ` +
          "Translate all requested fields together for a single locale. " +
          "Keep terminology, tone, and cross-field consistency internally aligned across fields. " +
          "Do not treat every app title as an immutable brand name. " +
          "If a title is descriptive and can be localized for the target market, localize/adapt it rather than copying it unchanged. " +
          "Preserve only clear non-translatable brand tokens or proprietary spellings. " +
          "Respect each field's stated length limit. " +
          'Return only a JSON object where each key matches the provided field "key" and each value is the translated string. ' +
          "Do not wrap the JSON in markdown." +
          titleInstruction +
          titleContext +
          masterHint,
      },
      {
        role: "user",
        content:
          `Translate these ${store} fields from ${options.sourceLocale} to ${options.targetLocale}. ` +
          "If one field is the app title, localize/adapt that title when appropriate for the target market, then keep the other fields consistent with it. " +
          "Return only JSON.\n\n" +
          JSON.stringify(payload),
      },
    ],
  });

  const parsed = parseJsonObjectResponse(raw);
  const result: Record<string, string> = {};
  for (const field of options.fields) {
    const value = parsed[field.key];
    if (typeof value !== "string") {
      throw new Error(`Batch translate response missing string for field "${field.key}".`);
    }
    result[field.key] = value.trim();
  }
  return result;
}

export async function shortenWithOpenAI(options: {
  config: AIConfig;
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

  return requestAI({
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

export async function shortenBatchWithOpenAI(options: {
  config: AIConfig;
  targetLocale: string;
  fields: OpenAIBatchField[];
  storeName?: string;
  masterPrompt?: string;
}): Promise<Record<string, string>> {
  const store = options.storeName ?? "App Store";
  const masterHint = options.masterPrompt
    ? ` Additional instructions: ${options.masterPrompt}`
    : "";

  const payload = {
    targetLocale: options.targetLocale,
    fields: options.fields.map((field) => ({
      key: field.key,
      maxLength: field.maxLength,
      lengthUnit: field.lengthUnit ?? "characters",
      text: field.text,
    })),
  };

  const raw = await requestAI({
    config: options.config,
    messages: [
      {
        role: "system",
        content:
          `You are a rewriting engine for ${store} listing text. ` +
          "Shorten the provided fields while preserving meaning, tone, branding, and cross-field consistency. " +
          "Do not add new information. " +
          'Return only a JSON object where each key matches the provided field "key" and each value is the shortened string. ' +
          "Do not wrap the JSON in markdown." +
          masterHint,
      },
      {
        role: "user",
        content:
          `Shorten these ${store} fields in ${options.targetLocale} to fit their limits. ` +
          "Return only JSON.\n\n" +
          JSON.stringify(payload),
      },
    ],
    temperature: 0.2,
  });

  const parsed = parseJsonObjectResponse(raw);
  const result: Record<string, string> = {};
  for (const field of options.fields) {
    const value = parsed[field.key];
    if (typeof value !== "string") {
      throw new Error(`Batch shorten response missing string for field "${field.key}".`);
    }
    result[field.key] = value.trim();
  }
  return result;
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
  config: AIConfig;
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

  const raw = await requestAI({
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

export async function verifyBatchWithOpenAI(options: {
  config: AIConfig;
  sourceLocale: string;
  targetLocale: string;
  fields: Array<{
    key: string;
    sourceText: string;
    translatedText: string;
  }>;
  storeName?: string;
  appTitle?: string;
  masterPrompt?: string;
}): Promise<Record<string, "evet" | "hayir">> {
  const store = options.storeName ?? "App Store";
  const titleContext = options.appTitle
    ? ` Uygulama adı hedef locale'de "${options.appTitle}".`
    : "";
  const masterHint = options.masterPrompt
    ? ` Ek talimat: ${options.masterPrompt}`
    : "";

  const payload = {
    sourceLocale: options.sourceLocale,
    targetLocale: options.targetLocale,
    fields: options.fields,
  };

  const raw = await requestAI({
    config: options.config,
    messages: [
      {
        role: "system",
        content:
          `You are a strict translation quality checker for ${store} listing text. ` +
          'Return only a JSON object where each key matches the provided field "key" and each value is exactly "evet" or "hayir". ' +
          "Do not add explanations. Do not wrap the JSON in markdown." +
          masterHint,
      },
      {
        role: "user",
        content:
          `Kaynak dil: ${options.sourceLocale}. Hedef dil: ${options.targetLocale}. Store: ${store}.` +
          `${titleContext} ` +
          "Her alan için çeviri iyi ve anlamı koruyan bir çeviri mi kontrol et. " +
          'Yalnızca JSON döndür; her değer sadece "evet" veya "hayir" olsun.\n\n' +
          JSON.stringify(payload),
      },
    ],
    temperature: 0,
  });

  const parsed = parseJsonObjectResponse(raw);
  const result: Record<string, "evet" | "hayir"> = {};
  for (const field of options.fields) {
    const rawVerdict = parsed[field.key];
    const verdict = normalizeVerifyAnswer(typeof rawVerdict === "string" ? rawVerdict : "");
    if (!verdict) {
      throw new Error(`Batch verify response missing valid verdict for field "${field.key}".`);
    }
    result[field.key] = verdict;
  }
  return result;
}
