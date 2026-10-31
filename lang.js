// lang.js — Vietnamese language helpers for Chào.
// Pure functions only (no DOM), so they can be unit-tested in Node.
//   • Pronouns + casual-polite tone layer for English→Vietnamese output
//   • Vietnamese number reading and price parsing (incl. colloquial "trăm rưỡi")
//   • English amount parsing for price offers ("can you do 150k?")
//   • Phrasebook matching and rendering
//   • Speech-recognition clean-up (punctuation, hallucination filter)

// ───────────────────────── Pronouns ─────────────────────────
// addr = what you call them, self = what you call yourself.
// particle = add the polite "ạ" (not used when speaking to someone younger).
export const PRONOUNS = {
  chi: { addr: 'chị', self: 'em', plural: 'các chị', particle: true, label: 'Chị', short: 'woman', hint: 'Woman, my age or older' },
  anh: { addr: 'anh', self: 'em', plural: 'các anh', particle: true, label: 'Anh', short: 'man', hint: 'Man, my age or older' },
  co:  { addr: 'cô', self: 'cháu', plural: 'cô chú', particle: true, label: 'Cô', short: 'older woman', hint: 'Woman, my parents’ age' },
  chu: { addr: 'chú', self: 'cháu', plural: 'cô chú', particle: true, label: 'Chú', short: 'older man', hint: 'Man, my parents’ age' },
  ba:  { addr: 'bà', self: 'cháu', plural: 'ông bà', particle: true, label: 'Bà', short: 'grandma age', hint: 'Elderly woman' },
  ong: { addr: 'ông', self: 'cháu', plural: 'ông bà', particle: true, label: 'Ông', short: 'grandpa age', hint: 'Elderly man' },
  em:  { addr: 'em', self: null, plural: 'các em', particle: false, label: 'Em', short: 'younger', hint: 'Younger than me' },
  ban: { addr: 'bạn', self: 'tôi', plural: 'các bạn', particle: true, label: 'Bạn', short: 'not sure', hint: 'Not sure / neutral' },
};

export function pronounsFor(ctx = {}) {
  const p = PRONOUNS[ctx.who] || PRONOUNS.chi;
  const self = p.self || (ctx.myGender === 'f' ? 'chị' : ctx.myGender === 'm' ? 'anh' : 'tôi');
  return { ...p, self };
}

const L = '\\p{L}\\p{M}\\p{N}';
const wb = (s) => new RegExp(`(?<![${L}])(${s})(?![${L}])`, 'giu');
const cap = (s) => (s ? s.charAt(0).toLocaleUpperCase('vi') + s.slice(1) : s);
const keepCase = (orig, repl) => (orig.charAt(0) === orig.charAt(0).toLocaleUpperCase('vi') && orig.charAt(0) !== orig.charAt(0).toLocaleLowerCase('vi') ? cap(repl) : repl);

// ───────────────────────── Tone layer ─────────────────────────
// Turns neutral machine translation ("Bạn có thể giảm giá cho tôi không?")
// into casual-polite shop Vietnamese ("Chị có thể giảm giá cho em không ạ?").
export function applyTone(text, ctx = {}) {
  if (!text) return text;
  const p = pronounsFor(ctx);
  const region = ctx.region === 's' ? 's' : 'n';
  let s = text.normalize('NFC').replace(/\s+/g, ' ').trim();

  // 1) Pronouns
  s = s.replace(wb('chúng tôi'), (m) => keepCase(m, p.self === 'tôi' ? 'chúng tôi' : `chúng ${p.self}`));
  s = s.replace(wb('các bạn'), (m) => keepCase(m, p.plural));
  s = s.replace(new RegExp(`(?<![${L}])(?<!(?:người|những|một|là) )(bạn)(?![${L}])(?! (?:bè|trai|gái|thân|học|cùng|đời|đồng|ấy|của tôi|của mình))`, 'giu'),
    (m) => keepCase(m, p.addr));
  s = s.replace(wb('mày'), (m) => keepCase(m, p.addr));
  s = s.replace(wb('tôi|tao'), (m) => keepCase(m, p.self));

  const regionize = (x) => (region === 's'
    ? x.replace(wb('nghìn'), (m) => keepCase(m, 'ngàn')).replace(wb('đắt'), (m) => keepCase(m, 'mắc'))
    : x);
  if (ctx.polite === false) return finish(regionize(s));

  const A = p.addr, S = p.self;
  const tail = p.particle ? 'ạ' : '';
  const end = /[.?!…]+$/.exec(s)?.[0] || '';
  let body = s.slice(0, s.length - end.length).trim();
  const isQ = end.includes('?');

  // 2) Greetings: "Xin chào" is textbook-stiff; people say "Chào chị ạ".
  body = body.replace(/^xin chào(?:,)?(?:\s+(?:anh|chị|cô|chú|bà|ông|em|bạn))?/iu, `Chào ${A}`);

  // 3) Requests: "Vui lòng ..." reads like a sign. Make it a spoken request.
  const req = /^(?:xin\s+)?(?:vui lòng|làm ơn|xin hãy|hãy)\s+(.*)$/iu.exec(body);
  if (req) {
    const rest = req[1].replace(new RegExp(`^${A}\\s+`, 'iu'), '');
    if (/^cho\s/iu.test(rest)) body = `${cap(A)} ${rest} với`;
    else body = `${cap(A)} ${rest} giúp ${S} với`;
    if (!isQ) body += tail ? ` ${tail}` : ' nhé';
    return finish(regionize(body) + (isQ ? '?' : '.'));
  }

  // 4) Short answers
  if (p.particle) {
    body = body.replace(/^vâng(?=[,\s]|$)/iu, region === 's' ? 'Dạ' : 'Vâng');
    body = body.replace(/^(không|có)(?=,)/iu, (m) => `Dạ ${m.toLocaleLowerCase('vi')}`);
  }

  // 5) Thanks / sorry: make sure the person is named, then soften.
  body = body.replace(/^(cảm ơn|xin lỗi)(?!\s+(?:anh|chị|cô|chú|bà|ông|em|bạn|các))/iu, (m) => `${m} ${A}`);

  // 6) Polite particle
  if (tail && !/(?:ạ|nhé|nhỉ|nha|hả|à|ơi)$/iu.test(body)) {
    const lower = body.toLocaleLowerCase('vi');
    const startsPolite = /^(cảm ơn|xin lỗi|chào|dạ|vâng)/iu.test(lower);
    const startsWithSelf = lower.startsWith(S + ' ') || lower.startsWith(`chúng ${S} `);
    const words = body.split(/\s+/).length;
    if (isQ || startsWithSelf || (startsPolite && words <= 10)) body += ` ${tail}`;
  }

  // 7) Region vocabulary (MT output is northern-standard)
  return finish(regionize(body) + (end || '.'));
}

function finish(s) {
  s = s.replace(/\s+([,.?!])/g, '$1').replace(/\s+/g, ' ').trim();
  return cap(s);
}

// ───────────────────────── Phrasebook ─────────────────────────
// Templates: {A} = them, {S} = me, {north|south} = regional variant.
export function renderPhrase(tpl, ctx = {}) {
  const p = pronounsFor(ctx);
  const south = ctx.region === 's';
  let s = tpl.replace(/\{([^{}|]*)\|([^{}]*)\}/g, (_, n, so) => (south ? so : n))
    .replace(/\{A\}/g, p.addr).replace(/\{S\}/g, p.self);
  if (!p.particle) {
    s = s.replace(/^Dạ(?: thôi)?,?\s*/u, (m) => (m.includes('thôi') ? 'Thôi, ' : ''))
      .replace(/\s+ạ(?=[.?!]|$)/gu, '');
    if (/^(?:Vâng)?[.!]?$/u.test(s.trim())) s = 'Ừ.';
  }
  return finish(s);
}

export function normalizeEn(s) {
  return (s || '').toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/(\d)[,.](?=\d{3}\b)/g, '$1').replace(/(\d)\.(\d)/g, '$1§$2')
    .replace(/\bwhat's\b/g, 'what is').replace(/\bthat's\b/g, 'that is').replace(/\bit's\b/g, 'it is')
    .replace(/\bi'm\b/g, 'i am').replace(/\bi'll\b/g, 'i will').replace(/\bdon't\b/g, 'do not')
    .replace(/\bcan't\b/g, 'cannot').replace(/\bcannot\b/g, 'can not').replace(/\bcolour/g, 'color')
    .replace(/\b(please|pls|sir|madam|ma'am|auntie|uncle|um+|uh+|hey|so)\b/g, ' ')
    .replace(/[^a-z0-9'§ ]+/g, ' ').replace(/§/g, '.').replace(/\s+/g, ' ').trim();
}

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

// Returns the best phrasebook entry if the English input is (nearly) the same sentence.
export function matchPhrase(input, phrases, threshold = 0.84) {
  const q = normalizeEn(input);
  if (!q || q.split(' ').length > 14) return null;
  let best = null, bestScore = 0;
  for (const ph of phrases) {
    for (const cand of [ph.en, ...(ph.alts || [])]) {
      const c = normalizeEn(cand);
      if (!c) continue;
      const score = 1 - lev(q, c) / Math.max(q.length, c.length);
      if (score > bestScore) { bestScore = score; best = ph; }
    }
  }
  return bestScore >= threshold ? { phrase: best, score: bestScore } : null;
}

// ───────────────────────── Vietnamese numbers ─────────────────────────
const D = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readGroup(n, full) {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, u = n % 10;
  const out = [];
  if (h > 0 || full) out.push(D[h], 'trăm');
  if (t === 0) { if (u > 0 && (h > 0 || full)) out.push('lẻ'); }
  else if (t === 1) out.push('mười');
  else out.push(D[t], 'mươi');
  if (u > 0) {
    if (u === 1 && t >= 2) out.push('mốt');
    else if (u === 5 && t >= 1) out.push('lăm');
    else out.push(D[u]);
  }
  return out.join(' ');
}

// 150000 → "một trăm năm mươi nghìn" (south: "ngàn")
export function numberToVi(num, region = 'n') {
  let n = Math.round(Math.abs(Number(num)));
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'không';
  const thousand = region === 's' ? 'ngàn' : 'nghìn';
  const units = ['', thousand, 'triệu', 'tỷ', `${thousand} tỷ`];
  const groups = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const leading = i === groups.length - 1;
    const full = !leading && g < 10; // 1.005.000 → "một triệu không trăm lẻ năm nghìn"
    parts.push(readGroup(g, full) + (units[i] ? ' ' + units[i] : ''));
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function formatVnd(n) {
  const s = String(Math.round(n));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
export function formatThousands(n, sep = ',') {
  const [i, d] = String(Math.round(n * 100) / 100).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (d ? '.' + d : '');
}

// Digits → words so any Vietnamese voice (including the backup model) reads prices naturally.
export function viForSpeech(text, region = 'n') {
  return (text || '')
    .replace(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:đ|₫|vnđ|vnd)(?![\p{L}])/giu, (m, num) => `${numberToVi(parseNumToken(num), region)} đồng`)
    .replace(/(\d{1,3}(?:[.,]\d{3})+|\d+)(k)(?![\p{L}])/giu, (m, num) => `${numberToVi(parseNumToken(num) * 1000, region)}`)
    .replace(/\d{1,3}(?:[.,]\d{3})+|\d+/g, (m) => numberToVi(parseNumToken(m), region))
    .replace(/%/g, ' phần trăm');
}

// "150.000" / "150,000" → 150000 ; "1,5" / "2.5" → 1.5 / 2.5
export function parseNumToken(tok) {
  const t = String(tok).replace(/k$/i, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''));
  if (/^\d+[.,]\d+$/.test(t)) return Number(t.replace(',', '.'));
  return Number(t);
}

const DIG = { 'không': 0, 'một': 1, 'mốt': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'tư': 4, 'năm': 5, 'lăm': 5, 'nhăm': 5, 'sáu': 6, 'bảy': 7, 'bẩy': 7, 'tám': 8, 'chín': 9 };
const MAG = { 'tỷ': 1e9, 'tỉ': 1e9, 'triệu': 1e6, 'nghìn': 1e3, 'ngàn': 1e3, 'ngàn': 1e3, 'k': 1e3 };
const NUMWORD = new Set([...Object.keys(DIG), ...Object.keys(MAG), 'mười', 'mươi', 'trăm', 'lẻ', 'linh', 'rưỡi', 'chục']);
const MONEY_MAG = new Set(['nghìn', 'ngàn', 'triệu', 'tỷ', 'tỉ', 'k']);
const CURRENCY = new Set(['đồng', 'đ', 'vnd', 'vnđ', '₫']);
// Words that mean a number is a count, not a price ("hai mươi cái" = 20 items)
const COUNT_WORDS = new Set(['cái', 'con', 'chiếc', 'đôi', 'bộ', 'quả', 'trái', 'kg', 'kí', 'ký', 'cân', 'lạng', 'gram', 'gam', 'người', 'ngày', 'giờ', 'phút', 'năm', 'tuổi', 'lần', 'ly', 'cốc', 'chai', 'lon', 'phần', 'tô', 'bát', 'đĩa', 'cây', 'hộp', 'gói', 'túi', 'tháng', 'tuần', 'km', 'mét', 'cm', 'số', 'tầng', 'phòng', 'đêm', 'xuất', 'suất', 'miếng', 'cuốn', 'quyển', 'tấm', 'chục']);

const digitOf = (t) => (typeof t === 'number' ? (t < 10 && Number.isInteger(t) ? t : null) : (t in DIG ? DIG[t] : null));

function parseTens(toks) {
  if (toks.length === 0) return 0;
  if (toks[0] === 'mười') {
    if (toks.length === 1) return 10;
    if (toks.length === 2 && digitOf(toks[1]) != null) return 10 + digitOf(toks[1]);
    return NaN;
  }
  if (toks[0] === 'chục' && toks.length === 1) return 10;
  if (toks.length >= 2 && (toks[1] === 'mươi' || toks[1] === 'chục') && digitOf(toks[0]) != null) {
    const base = digitOf(toks[0]) * 10;
    if (toks.length === 2) return base;
    if (toks.length === 3 && digitOf(toks[2]) != null) return base + digitOf(toks[2]);
    return NaN;
  }
  if (toks.length === 1 && typeof toks[0] === 'number') return toks[0];
  if (toks.length === 1 && digitOf(toks[0]) != null) return digitOf(toks[0]);
  return NaN;
}

function parseGroup(toks) {
  if (!toks.length) return NaN;
  let i = 0, val = 0;
  if (toks[0] === 'trăm') { val = 100; i = 1; }
  else if (toks[1] === 'trăm' && (digitOf(toks[0]) != null || typeof toks[0] === 'number')) { val = Number(typeof toks[0] === 'number' ? toks[0] : digitOf(toks[0])) * 100; i = 2; }
  if (i > 0) {
    const rest = toks.slice(i);
    if (!rest.length) return val;
    if (rest.length === 1 && rest[0] === 'rưỡi') return val + 50;
    if (rest.length === 2 && (rest[0] === 'lẻ' || rest[0] === 'linh') && digitOf(rest[1]) != null) return val + digitOf(rest[1]);
    if (rest.length === 1 && digitOf(rest[0]) != null) return val + digitOf(rest[0]) * 10; // "trăm hai" = 120
    const t = parseTens(rest);
    return Number.isNaN(t) ? NaN : val + t;
  }
  return parseTens(toks);
}

// Parses a run of Vietnamese number tokens: ["hai","trăm","rưỡi","nghìn"] → 250000
export function parseViAmount(toks) {
  let total = 0, buf = [], lastMag = 0;
  for (const t of toks) {
    if (typeof t === 'string' && MAG[t]) {
      const g = buf.length ? parseGroup(buf) : 1;
      if (Number.isNaN(g)) return NaN;
      total += g * MAG[t]; lastMag = MAG[t]; buf = [];
    } else buf.push(t);
  }
  if (buf.length) {
    if (lastMag && buf.length === 1 && buf[0] === 'rưỡi') total += lastMag / 2;
    else if (lastMag && buf.length === 1 && digitOf(buf[0]) != null) total += digitOf(buf[0]) * lastMag / 10; // "hai triệu ba" = 2.3tr
    else { const g = parseGroup(buf); if (Number.isNaN(g)) return NaN; total += g; }
  }
  return total;
}

// Rewrites spoken-out numbers in Vietnamese ASR text as digits so the
// translator keeps them exact, and reports amounts that look like prices.
//   "cái này một trăm rưỡi nghìn" → "cái này 150000 đồng"
export function normalizeViMoney(text) {
  const src = (text || '').normalize('NFC');
  const re = /\d+(?:[.,]\d+)*k?|[\p{L}\p{M}₫]+|[^\s]/gu;
  const toks = [];
  let m;
  while ((m = re.exec(src))) toks.push({ raw: m[0], low: m[0].toLocaleLowerCase('vi'), start: m.index, end: m.index + m[0].length });
  const isNum = (t) => /^\d/.test(t.low);
  const amounts = [];
  const out = [];
  let last = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const startsRun = isNum(t) || DIG[t.low] != null || t.low === 'mười' || t.low === 'trăm';
    if (!startsRun) continue;
    let j = i;
    const seq = [];
    while (j < toks.length) {
      const w = toks[j];
      if (isNum(w)) {
        if (/k$/i.test(w.low)) { seq.push(parseNumToken(w.low), 'k'); j++; break; }
        seq.push(parseNumToken(w.low)); j++; continue;
      }
      // after "mươi/mười" a 5 is said "lăm"; "hai mươi năm" means twenty *years*
      if (w.low === 'năm' && (seq.at(-1) === 'mươi' || seq.at(-1) === 'mười')) break;
      if (NUMWORD.has(w.low)) { seq.push(w.low); j++; continue; }
      break;
    }
    // trim trailing words that can't end a number ("lẻ", "linh")
    while (seq.length && (seq[seq.length - 1] === 'lẻ' || seq[seq.length - 1] === 'linh')) { seq.pop(); j--; }
    const words = seq.filter((x) => typeof x === 'string');
    const hasMagnitude = words.some((w) => w !== 'k' && !(w in DIG));
    const numericOnly = seq.every((x) => typeof x === 'number');
    const cur = toks[j] && CURRENCY.has(toks[j].low);
    const money = cur || words.some((w) => MONEY_MAG.has(w));
    // single word numbers like "năm" (also = "year") or "ba" (also = "dad") stay as words
    if (!money && !hasMagnitude && !numericOnly) continue;
    const value = parseViAmount(seq);
    if (!Number.isFinite(value) || Number.isNaN(value)) continue;
    const endTok = cur ? toks[j] : toks[j - 1];
    const next = toks[j] && toks[j].low;
    const isCount = !money && next && COUNT_WORDS.has(next);
    out.push(src.slice(last, t.start));
    if (money) {
      out.push(`${Math.round(value)} đồng`);
      amounts.push({ value: Math.round(value), implied: false });
    } else {
      out.push(String(value));
      if (!isCount && Number.isInteger(value)) {
        if (numericOnly && value >= 1000) amounts.push({ value, implied: false, weak: true });
        else if (value > 0 && value < 1000) amounts.push({ value, implied: true });
      }
    }
    last = endTok.end;
    i = cur ? j : j - 1;
  }
  out.push(src.slice(last));
  return { text: out.join('').replace(/\s+/g, ' ').trim(), amounts };
}

const PRICE_WORDS = /(giá|tiền|bao nhiêu|bán|mua|bớt|trả|thối|đắt|mắc|rẻ|tổng|tính|đồng)/iu;

// Prices quoted without "nghìn" usually mean thousands: "năm mươi" = 50.000đ.
export function priceHints(normalized, context = {}) {
  const priceish = PRICE_WORDS.test(normalized.text) || !!context.askedPrice;
  const hints = [];
  for (const a of normalized.amounts) {
    if (!a.implied && !a.weak) hints.push({ vnd: a.value, said: a.value, implied: false });
    else if (a.weak && priceish && a.value % 100 === 0) hints.push({ vnd: a.value, said: a.value, implied: false });
    else if (a.implied && priceish && a.value >= 5) hints.push({ vnd: a.value * 1000, said: a.value, implied: true });
  }
  return hints;
}

// After VI→EN: "150000 dong" → "150,000 dong"
export function fixEnMoney(en) {
  return (en || '')
    .replace(/(\d)\.(?=\d{3}\b)/g, '$1') // 150.000 → 150000 first
    .replace(/\b(\d{4,})\b(?=\s*(?:vietnamese\s+)?(?:dong|vnd|đồng|d\b|₫))/giu, (n) => formatThousands(Number(n)))
    .replace(/\bdongs\b/gi, 'dong');
}

// ───────────────────────── English amounts (offers) ─────────────────────────
const EN_NUM = { zero: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const EN_MAG = { hundred: 100, thousand: 1e3, k: 1e3, grand: 1e3, million: 1e6, mil: 1e6, m: 1e6 };

export function parseEnAmount(str) {
  let s = (str || '').toLowerCase().replace(/\b(?:vnd|dong|d|bucks)\b|đồng|₫/g, ' ').replace(/(\d),(?=\d{3})/g, '$1')
    .replace(/(\d)(k|m)\b/g, '$1 $2').replace(/-/g, ' ').replace(/\band\b/g, ' ').trim();
  const toks = s.split(/\s+/).filter(Boolean);
  if (!toks.length) return null;
  let total = 0, cur = 0, seen = false;
  for (const t of toks) {
    if (/^\d+(\.\d+)?$/.test(t)) { cur += Number(t); seen = true; }
    else if (t in EN_NUM) { if ((t === 'a' || t === 'an')) { cur += 1; continue; } cur += EN_NUM[t]; seen = true; }
    else if (t in EN_MAG) {
      const mag = EN_MAG[t];
      if (cur === 0) cur = 1;
      if (mag === 100) cur *= 100;
      else { total += cur * mag; cur = 0; }
      seen = true;
    } else return null;
  }
  if (!seen) return null;
  const v = Math.round(total + cur);
  return v > 0 ? v : null;
}

const OFFER_RES = [
  /^(?:can|could|would|will) you (?:do|make it|take|accept|sell (?:it|this|that|them|these|both) (?:for|at)|give (?:it|this|that) to me for|go|let (?:it|me have it) go for)\s+(.+?)(?:\s+(?:for (?:it|this|that|both|them)|instead))?$/,
  /^(?:how about|what about|ok for|okay for|deal for|maybe|is|and)\s+(.+?)(?:\s+(?:ok|okay|possible|fine|alright))?$/,
  /^(?:i (?:will|can|could) (?:pay|give you|do|offer|take it for)|i(?: will)? offer|my offer is|last price)\s+(.+?)$/,
  /^(.+?)\s+(?:ok|okay|possible|fine|alright|deal)$/,
];

// "Can you do 150k?" → { amount: 150000 }
export function parseOffer(input) {
  const q = normalizeEn(input);
  for (const re of OFFER_RES) {
    const m = re.exec(q);
    if (!m) continue;
    let v = parseEnAmount(m[1]);
    if (!v) continue;
    if (v < 1000) v *= 1000; // "how about 150?" in Vietnam means 150,000₫
    return { amount: v };
  }
  return null;
}

export function renderOffer(amount, ctx = {}) {
  const p = pronounsFor(ctx);
  const ask = p.addr === 'bạn' ? 'được không?' : `được không ${p.addr}?`;
  return { display: `${formatVnd(amount)}đ ${ask}`, speak: `${cap(numberToVi(amount, ctx.region))} ${ask}` };
}

// ───────────────────────── Speech-recognition clean-up ─────────────────────────
const HALLUCINATIONS = [
  /subscribe/i, /đăng k[ýí] (?:cho )?kênh/i, /ghiền mì gõ/i, /cảm ơn (?:các bạn|mọi người) đã (?:theo dõi|xem)/i,
  /hẹn gặp lại (?:các bạn|mọi người)/i, /like và share/i, /theo dõi kênh/i, /video (?:tiếp theo|này)/i,
  /la la school/i, /nhấn like/i, /bỏ lỡ những video/i, /thanks? (?:you )?for watching/i, /see you (?:in the )?next/i,
  /^\W*(?:music|applause|silence|blank_audio|inaudible)\W*$/i, /♪/, /^\[.*\]$/, /^\(.*\)$/, /amara\.org/i, /字幕/,
];

export function isHallucination(text) {
  const t = (text || '').trim();
  if (!t) return true;
  if ((t.match(/[\p{L}]/gu) || []).length < 1) return true;
  return HALLUCINATIONS.some((re) => re.test(t));
}

function collapseRepeats(t) {
  // "dạ dạ dạ dạ dạ dạ" or a phrase looping → keep two copies at most
  return t.replace(/(?<!\S)((?:\S+\s+){0,5}?\S+)(?:\s+\1(?=\s|$)){2,}/giu, '$1 $1');
}

const VI_Q_END = /(?:bao nhiêu|mấy|gì|đâu|nào|ai|sao|thế nào|ra sao|không|chưa|hả|à|hở|nhỉ|chứ|được không|phải không|đúng không|nhé|nha)$/iu;
const VI_Q_ANY = /(?:bao nhiêu|ở đâu|cái gì|tại sao|thế nào|làm sao|mấy giờ|bao lâu)/iu;

export function looksLikeViQuestion(t) {
  return VI_Q_END.test(t) || VI_Q_ANY.test(t);
}

export function cleanAsr(text, lang = 'vi') {
  let t = (text || '').normalize('NFC').replace(/\s+/g, ' ').replace(/^[\s\-–—"'“”.,:;]+|[\s\-–—"'“”:;,]+$/g, '').trim();
  if (isHallucination(t)) return '';
  t = collapseRepeats(t);
  if (lang === 'vi') {
    const hasEnd = /[.?!…]$/.test(t);
    if (!hasEnd) t += looksLikeViQuestion(t.toLocaleLowerCase('vi')) ? '?' : '.';
    t = cap(t);
  }
  return t;
}

// Vietnamese-only letters: if typed text has these, translate it to English instead.
export function looksVietnamese(text) {
  return /[ăâđêôơưạảãáàặẳẵắằậẩẫấầẹẻẽéèệểễếềịỉĩíìọỏõóòộổỗốồợởỡớờụủũúùựửữứừỵỷỹýỳ]/iu.test(text || '');
}

export function looksChinese(text) {
  return /[㐀-鿿]/.test(text || '');
}

export function splitSentences(text) {
  const parts = (text || '').match(/[^.?!。？！]+[.?!。？！]*/gu) || [];
  return parts.map((s) => s.trim()).filter(Boolean);
}
