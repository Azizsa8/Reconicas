// TS port of recon/intent.py — heuristic NL → DSL translator.
// Order matters: more specific rules first.

export type IntentResult = {
  ok: boolean;
  expression: string | null;
  label: string | null;
  explanation: string;
  confidence: number;
};

function firstNumber(t: string): number | null {
  const m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function firstPct(t: string): number | null {
  const m = t.match(/-?\d+(?:\.\d+)?\s*%/);
  return m ? Number(m[0].replace(/[%\s]/g, "")) : null;
}

export function parseIntent(text: string): IntentResult {
  const raw = (text || "").trim();
  if (!raw) {
    return { ok: false, expression: null, label: null, explanation: "empty intent", confidence: 0 };
  }
  const t = raw.toLowerCase();

  // 1) back in stock
  if (/back[\s-]in[\s-]stock|restocked|comes? back/.test(t)) {
    return {
      ok: true,
      expression: "was_in_stock == False and is_in_stock == True",
      label: "back-in-stock",
      explanation: "fires when availability flips from out-of-stock to in-stock",
      confidence: 0.9,
    };
  }

  // 2) out of stock
  if (/out[\s-]of[\s-]stock|sold out|\boos\b/.test(t)) {
    return {
      ok: true,
      expression: 'availability == "OutOfStock"',
      label: "out-of-stock",
      explanation: "fires when product is out of stock",
      confidence: 0.9,
    };
  }

  // 3) percentage price moves
  if (t.includes("%") || t.includes("percent")) {
    const pct = firstPct(t) ?? firstNumber(t);
    if (pct != null) {
      const mag = Math.abs(pct);
      if (/(drop|down|fall|decrease|discount|swing)/.test(t)) {
        return {
          ok: true,
          expression: `price_change_pct <= -${mag}`,
          label: `price drop ≥ ${mag}%`,
          explanation: `fires when price has fallen by at least ${mag}% vs the previous scrape`,
          confidence: 0.85,
        };
      }
      if (/(rise|up\b|jump|increase|hike)/.test(t)) {
        return {
          ok: true,
          expression: `price_change_pct >= ${mag}`,
          label: `price rise ≥ ${mag}%`,
          explanation: `fires when price has risen by at least ${mag}% vs the previous scrape`,
          confidence: 0.85,
        };
      }
      // bare "10% swing" = either direction
      return {
        ok: true,
        expression: `abs(price_change_pct) >= ${mag}`,
        label: `price swing ≥ ${mag}%`,
        explanation: `fires on any ${mag}% price movement vs the previous scrape`,
        confidence: 0.75,
      };
    }
  }

  // 4) rating below
  if (t.includes("rating") && /(below|under|less than|drop|<)/.test(t)) {
    const n = firstNumber(t);
    if (n != null) {
      return {
        ok: true,
        expression: `rating < ${n}`,
        label: `rating < ${n}`,
        explanation: `fires when product rating is below ${n}`,
        confidence: 0.85,
      };
    }
  }

  // 5) review count grows
  if (t.includes("review")) {
    const n = firstNumber(t);
    if (n != null && /(grow|new|more|added|gain|delta|by)/.test(t)) {
      const i = Math.trunc(n);
      return {
        ok: true,
        expression: `review_count_delta >= ${i}`,
        label: `+${i} reviews`,
        explanation: `fires when review count grows by ≥ ${i} since last scrape`,
        confidence: 0.75,
      };
    }
  }

  // 6) explicit price thresholds
  const priceWord = /(price|cost|\bsar\b|\busd\b|\baed\b|\$|ريال)/.test(t);
  const lowerOp = /(below|under|less than|<|cheaper than)/.test(t);
  const upperOp = /(above|over|more than|>|exceeds)/.test(t);
  if (priceWord && lowerOp) {
    const n = firstNumber(t);
    if (n != null) {
      return {
        ok: true,
        expression: `price < ${n}`,
        label: `price < ${n}`,
        explanation: `fires when current price is below ${n}`,
        confidence: 0.8,
      };
    }
  }
  if (priceWord && upperOp) {
    const n = firstNumber(t);
    if (n != null) {
      return {
        ok: true,
        expression: `price > ${n}`,
        label: `price > ${n}`,
        explanation: `fires when current price is above ${n}`,
        confidence: 0.8,
      };
    }
  }

  // 7) bare "drops below 30" — implicit price
  if (!priceWord && /(drop|below|under|less than|<|cheaper)/.test(t)) {
    const n = firstNumber(t);
    if (n != null) {
      return {
        ok: true,
        expression: `price < ${n}`,
        label: `price < ${n}`,
        explanation: `assumed price below ${n} (mention "price" to disambiguate)`,
        confidence: 0.6,
      };
    }
  }

  return {
    ok: false,
    expression: null,
    label: null,
    explanation:
      "Could not translate. Try phrasings like 'price below 30', 'out of stock', " +
      "'back in stock', 'drops 10%', '50 new reviews', or 'rating below 4'.",
    confidence: 0,
  };
}
