export type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

export async function translateWithOpenAI(options: {
  config: OpenAIConfig;
  sourceLocale: string;
  targetLocale: string;
  text: string;
  fieldName?: string;
}): Promise<string> {
  const { config, sourceLocale, targetLocale, text, fieldName } = options;
  const baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const fieldHint = fieldName ? ` for the App Store ${fieldName}` : "";

  const payload = {
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "You are a translation engine for App Store listing text. " +
          "Translate accurately, keep line breaks and formatting, and return only the translated text.",
      },
      {
        role: "user",
        content: `Translate${fieldHint} from ${sourceLocale} to ${targetLocale}:\n\n${text}`,
      },
    ],
    temperature: 0.2,
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
    throw new Error(message);
  }

  const data = raw ? JSON.parse(raw) : null;
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI response missing translated content.");
  }

  return content.trim();
}
