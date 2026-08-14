/**
 * Dollar-cost estimation based on model name and token count.
 * Prices are per 1 000 tokens (input). Output pricing is approximated at 2x input.
 */

interface ModelPricing {
  inputPer1k: number;
  outputPer1k: number;
}

const PRICING: Record<string, ModelPricing> = {
  "gpt-4": { inputPer1k: 0.03, outputPer1k: 0.06 },
  "gpt-4-turbo": { inputPer1k: 0.01, outputPer1k: 0.03 },
  "gpt-4o": { inputPer1k: 0.005, outputPer1k: 0.015 },
  "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  "gpt-3.5-turbo": { inputPer1k: 0.0005, outputPer1k: 0.0015 },
  "claude-3-opus": { inputPer1k: 0.015, outputPer1k: 0.075 },
  "claude-3-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-3-haiku": { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  "gemini-1.5-flash": { inputPer1k: 0.000075, outputPer1k: 0.0003 },
  "gemini-1.5-pro": { inputPer1k: 0.00125, outputPer1k: 0.005 },
};

const DEFAULT_PRICING: ModelPricing = { inputPer1k: 0.002, outputPer1k: 0.006 };

function resolvePricing(model: string): ModelPricing {
  const lower = model.toLowerCase();
  for (const [key, pricing] of Object.entries(PRICING)) {
    if (lower.includes(key)) return pricing;
  }
  return DEFAULT_PRICING;
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens?: number
): number {
  const pricing = resolvePricing(model);
  const inputCost = (inputTokens / 1000) * pricing.inputPer1k;
  const outputCost = ((outputTokens ?? inputTokens) / 1000) * pricing.outputPer1k;
  return parseFloat((inputCost + outputCost).toFixed(6));
}
