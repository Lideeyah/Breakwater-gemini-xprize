/**
 * Rough token estimation: split by whitespace and punctuation, then apply
 * a 1.3x multiplier to approximate BPE tokenisation.
 */

const SPLIT_RE = /[\s,.!?;:'"()\[\]{}<>\/\\|@#$%^&*~`+=\-_]+/;
const TOKEN_FACTOR = 1.3;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const words = text.split(SPLIT_RE).filter(Boolean);
  return Math.ceil(words.length * TOKEN_FACTOR);
}

export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 0;
  for (const msg of messages) {
    // ~4 tokens per-message overhead (role, delimiters)
    total += 4;
    total += estimateTokens(msg.content ?? "");
  }
  // final assistant-reply priming
  total += 3;
  return total;
}
