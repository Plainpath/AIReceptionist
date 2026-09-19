const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

function wordToNumber(w: string): number | null {
  const lw = w.toLowerCase();
  if (/^\d+(\.\d+)?$/.test(lw)) return parseFloat(lw);
  if (lw in NUMBER_WORDS) return NUMBER_WORDS[lw];
  // "ninety five" style compounds joined by a space are handled by caller.
  return null;
}

function titleCase(s: string) {
  return s.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1));
}

export type PriceBookItem = { label: string; rate: number; unit: string };

export type ParsedLine = {
  label: string;
  qty: number;
  unit: string;
  rate: number;
  confidence: "High" | "Check";
  detail: string;
};

function bestBookMatch(text: string, book: PriceBookItem[]): PriceBookItem | null {
  const words = new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  let best: PriceBookItem | null = null;
  let bestScore = 0;
  for (const item of book) {
    const bookWords = item.label.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const score = bookWords.filter((w) => words.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore > 0 ? best : null;
}

function parseClause(raw: string, book: PriceBookItem[]): ParsedLine {
  let label = raw.trim();
  let qty = 1;
  let unit = "ea";
  let rateHeard: number | null = null;

  const atMatch = label.match(/\bat\s+\$?\s*([\w\s]+?)\s*$/i);
  if (atMatch) {
    const numTokens = atMatch[1].trim().split(/\s+/);
    const nums = numTokens.map(wordToNumber).filter((n): n is number => n !== null);
    if (nums.length) {
      rateHeard = nums.reduce((a, b) => (b >= 100 ? a * b : a + b), 0) || nums[0];
      if (numTokens.length === 1) rateHeard = nums[0];
      label = label.slice(0, atMatch.index).trim();
    }
  }

  const qtyUnitMatch = label.match(/^(\w+)\s+(hours?|hrs?)\b\s*/i);
  if (qtyUnitMatch) {
    qty = wordToNumber(qtyUnitMatch[1]) ?? 1;
    unit = "hr";
    label = label.slice(qtyUnitMatch[0].length).trim();
  } else {
    const leadNum = label.match(/^(\w+)\s+/);
    if (leadNum && wordToNumber(leadNum[1]) !== null) {
      qty = wordToNumber(leadNum[1])!;
      label = label.slice(leadNum[0].length).trim();
    }
  }

  label = label.replace(/^(a|an|of)\s+/i, "").trim();
  label = label.replace(/^(labour|labor)\b/i, "Labour");

  const book_match = bestBookMatch(label, book);

  if (rateHeard != null) {
    const displayLabel = book_match ? book_match.label : titleCase(label || "Line item");
    return {
      label: displayLabel,
      qty,
      unit,
      rate: rateHeard,
      confidence: "High",
      detail: `${qty} ${unit} × $${rateHeard} · rate heard, not from price book`,
    };
  }

  if (book_match) {
    return {
      label: book_match.label,
      qty,
      unit: book_match.unit,
      rate: book_match.rate,
      confidence: "Check",
      detail: `${qty} ${book_match.unit} × $${book_match.rate} · matched from price book`,
    };
  }

  return {
    label: titleCase(label || "Line item"),
    qty,
    unit,
    rate: 0,
    confidence: "Check",
    detail: `${qty} ${unit} · no rate heard, enter manually`,
  };
}

export function parseVoiceTranscript(transcript: string, book: PriceBookItem[]): ParsedLine[] {
  const clauses = transcript
    .split(/\s*(?:,|\band\b|\bplus\b)\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);
  if (!clauses.length) return [];
  return clauses.map((c) => parseClause(c, book));
}
