const MAX_KEY_ITEM_CHARS = 800;

/**
 * Parses numbered answer-key blocks (e.g. `1. ...`, `1) ...`, `No. 1 ...`, `Soal 1 ...`,
 * `Jawaban 1 ...`) from extracted 06B master key text into a map keyed by question number.
 */
export function parseMasterKeyByQuestion(rawText: string): Record<number, string> {
  const cleaned = rawText.replace(/\r\n?/g, "\n").trim();
  if (!cleaned) return {};

  const lines = cleaned.split("\n");
  const result: Record<number, string> = {};
  let currentNo: number | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentNo === null) return;
    const text = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (text && !result[currentNo]) {
      result[currentNo] =
        text.length > MAX_KEY_ITEM_CHARS
          ? `${text.slice(0, MAX_KEY_ITEM_CHARS)}…`
          : text;
    }
    buffer = [];
  };

  const markerRe =
    /^(?:(?:no\.?|soal|jawaban|kunci(?:\s+jawaban)?)\s*#?\s*(\d{1,2})\s*[.):\-–]?\s*|(\d{1,2})\s*[.)]\s+)(.*)$/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(markerRe);
    if (match) {
      const num = Number(match[1] ?? match[2]);
      if (Number.isInteger(num) && num >= 1 && num <= 60) {
        flush();
        currentNo = num;
        const remainder = (match[3] ?? "").trim();
        if (remainder) {
          buffer.push(remainder);
        }
        continue;
      }
    }

    if (currentNo !== null) {
      buffer.push(line);
    }
  }

  flush();
  return result;
}
