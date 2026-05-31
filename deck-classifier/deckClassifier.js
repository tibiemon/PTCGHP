/**
 * ============================================================
 * ポケカ デッキ自動判定ロジック — deckClassifier.js v2
 *
 * 【改訂方針】
 *  - デッキ名はカード名の「部分一致」ではなく「正規化後の完全一致」を優先
 *  - 2025〜2026年スタンダード環境の主要デッキを網羅
 *  - 複合デッキ（アルセウス＋○○など）を優先度高く判定
 *  - 未分類時は主力ポケモン名をそのままデッキ名に使用
 *
 * 【入力形式】
 *  cards: Array<{ id:string, name:string, count:number, category:string }>
 *  category: 'pokemon'|'goods'|'tool'|'supporter'|'stadium'|'energy'
 *
 * 【出力形式】
 *  { name:string, confidence:'high'|'medium'|'low', tags:string[], reason:string, candidates:Array }
 * ============================================================
 */

'use strict';

/* ============================================================
   正規化ユーティリティ
   ============================================================ */

/** カード名を正規化（全角→半角、スペース除去、小文字化） */
function normalize(s) {
  return String(s)
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    .trim()
    .toLowerCase();
}

/** カードリストに指定パターンが含まれるか（部分一致） */
function has(cards, pattern) {
  const p = normalize(pattern);
  return cards.some(c => normalize(c.name).includes(p));
}

/** カードリストから指定パターンに一致するカードを返す */
function find(cards, pattern) {
  const p = normalize(pattern);
  return cards.filter(c => normalize(c.name).includes(p));
}

/** カードの合計枚数を返す */
function totalCount(cards, pattern) {
  return find(cards, pattern).reduce((s, c) => s + c.count, 0);
}

/* ============================================================
   デッキ判定ルール定義
   ============================================================ */

/**
 * @typedef {Object} Rule
 * @property {string}   name       - デッキ表示名
 * @property {number}   priority   - 優先度（高いほど先に評価）
 * @property {string[]} tags       - タグ
 * @property {Function} match      - (pokemonCards, allCards) => boolean
 */

const RULES = [

  /* ================================================================
     複合デッキ（優先度 200〜）
     ================================================================ */

  {
    name: 'アルセウス＆ギラティナ',
    priority: 200, tags: ['無色', '超', 'VSTAR', '複合'],
    match: (p) => has(p,'アルセウス VSTAR') && has(p,'ギラティナ V'),
  },
  {
    name: 'アルセウス＆ルギア',
    priority: 200, tags: ['無色', 'VSTAR', '複合'],
    match: (p) => has(p,'アルセウス VSTAR') && has(p,'ルギア VSTAR'),
  },
  {
    name: 'アルセウス＆パオジアン',
    priority: 200, tags: ['無色', '水', 'VSTAR', '複合'],
    match: (p) => has(p,'アルセウス VSTAR') && has(p,'パオジアン ex'),
  },
  {
    name: 'アルセウス＆ドラパルト',
    priority: 200, tags: ['無色', '超', 'VSTAR', '複合'],
    match: (p) => has(p,'アルセウス VSTAR') && has(p,'ドラパルト ex'),
  },
  {
    name: 'ロストギラティナ',
    priority: 200, tags: ['超', 'VSTAR', 'ロスト', '複合'],
    match: (p) => has(p,'ギラティナ V') && has(p,'キュワワー'),
  },
  {
    name: 'ロストミュウ',
    priority: 200, tags: ['超', 'VMAX', 'ロスト', '複合'],
    match: (p) => has(p,'ミュウ VMAX') && has(p,'キュワワー'),
  },
  {
    name: 'ロストバレット',
    priority: 195, tags: ['ロスト', 'コントロール', '複合'],
    match: (p) => has(p,'ウッウ') && has(p,'キュワワー') && !has(p,'ギラティナ V') && !has(p,'ミュウ VMAX'),
  },
  {
    name: 'テツノカイナ＆ミライドン',
    priority: 200, tags: ['雷', 'ex', '複合'],
    match: (p) => has(p,'テツノカイナ ex') && has(p,'ミライドン ex'),
  },
  {
    name: 'リザードン＆ピジョット',
    priority: 200, tags: ['炎', 'ex', '2進化', '複合'],
    match: (p) => has(p,'リザードン ex') && has(p,'ピジョット ex'),
  },
  {
    name: 'パオジアン＆セグレイブ',
    priority: 200, tags: ['水', 'ex', '複合'],
    match: (p) => has(p,'パオジアン ex') && has(p,'セグレイブ'),
  },
  {
    name: 'サーナイト＆ピジョット',
    priority: 200, tags: ['超', 'ex', '2進化', '複合'],
    match: (p) => has(p,'サーナイト ex') && has(p,'ピジョット ex'),
  },
  {
    name: 'ドラパルト＆ピジョット',
    priority: 200, tags: ['超', 'ex', '2進化', '複合'],
    match: (p) => has(p,'ドラパルト ex') && has(p,'ピジョット ex'),
  },
  {
    name: 'ガチグマ＆ピジョット',
    priority: 200, tags: ['無色', 'ex', '複合'],
    match: (p) => has(p,'ガチグマ ex') && has(p,'ピジョット ex'),
  },
  {
    name: 'タケルライコ＆オーガポン',
    priority: 200, tags: ['雷', '草', 'ex', '複合'],
    match: (p) => has(p,'タケルライコ ex') && has(p,'オーガポン ex'),
  },
  {
    name: 'ディアルガ＆パルキア',
    priority: 200, tags: ['鋼', '水', 'VSTAR', '複合'],
    match: (p) => has(p,'ディアルガ VSTAR') && has(p,'パルキア VSTAR'),
  },
  {
    name: 'ムゲンダイナ＆ガラルファイヤー',
    priority: 200, tags: ['悪', 'VMAX', 'V', '複合'],
    match: (p) => has(p,'ムゲンダイナ VMAX') && has(p,'ガラルファイヤー V'),
  },

  /* ================================================================
     単体主力デッキ（優先度 100〜）
     ================================================================ */

  // ── 炎 ──
  {
    name: 'リザードン ex',
    priority: 100, tags: ['炎', 'ex', '2進化'],
    match: (p) => has(p,'リザードン ex') && !has(p,'ピジョット ex'),
  },
  {
    name: 'メガリザードン ex',
    priority: 110, tags: ['炎', 'ex', 'メガ進化'],
    match: (p) => has(p,'メガリザードン ex'),
  },
  {
    name: 'ソウブレイズ ex',
    priority: 100, tags: ['炎', 'ex', '1進化'],
    match: (p) => has(p,'ソウブレイズ ex'),
  },
  {
    name: 'グレンアルマ ex',
    priority: 100, tags: ['炎', 'ex', '2進化'],
    match: (p) => has(p,'グレンアルマ ex'),
  },
  {
    name: 'ヒードラン ex',
    priority: 100, tags: ['炎', 'ex', 'たね'],
    match: (p) => has(p,'ヒードラン ex'),
  },

  // ── 水 ──
  {
    name: 'パオジアン ex',
    priority: 100, tags: ['水', 'ex', 'たね'],
    match: (p) => has(p,'パオジアン ex') && !has(p,'セグレイブ') && !has(p,'アルセウス VSTAR'),
  },
  {
    name: 'パルキア VSTAR',
    priority: 100, tags: ['水', 'VSTAR'],
    match: (p) => has(p,'パルキア VSTAR') && !has(p,'ディアルガ VSTAR'),
  },
  {
    name: 'ゲッコウガ ex',
    priority: 100, tags: ['水', 'ex', '2進化'],
    match: (p) => has(p,'ゲッコウガ ex'),
  },
  {
    name: 'オーガポン ex（いどのめん）',
    priority: 100, tags: ['水', 'ex', 'たね'],
    match: (p) => has(p,'オーガポン ex（いどのめん）') || has(p,'オーガポン ex(いどのめん)'),
  },
  {
    name: 'イルカマン ex',
    priority: 100, tags: ['水', 'ex', '1進化'],
    match: (p) => has(p,'イルカマン ex'),
  },
  {
    name: 'ホエルオー ex',
    priority: 100, tags: ['水', 'ex', '2進化'],
    match: (p) => has(p,'ホエルオー ex'),
  },

  // ── 雷 ──
  {
    name: 'ミライドン ex',
    priority: 100, tags: ['雷', 'ex', 'たね'],
    match: (p) => has(p,'ミライドン ex') && !has(p,'テツノカイナ ex'),
  },
  {
    name: 'テツノカイナ ex',
    priority: 100, tags: ['雷', 'ex', 'たね'],
    match: (p) => has(p,'テツノカイナ ex') && !has(p,'ミライドン ex'),
  },
  {
    name: 'タケルライコ ex',
    priority: 100, tags: ['雷', 'ex', 'たね'],
    match: (p) => has(p,'タケルライコ ex') && !has(p,'オーガポン ex'),
  },
  {
    name: 'ピカチュウ ex',
    priority: 100, tags: ['雷', 'ex', 'たね'],
    match: (p) => has(p,'ピカチュウ ex'),
  },
  {
    name: 'ライコウ V',
    priority: 100, tags: ['雷', 'V', 'たね'],
    match: (p) => has(p,'ライコウ V'),
  },
  {
    name: 'ブリジュラス ex',
    priority: 100, tags: ['雷', 'ex', '1進化'],
    match: (p) => has(p,'ブリジュラス ex'),
  },
  {
    name: 'メガゼラオラ ex',
    priority: 100, tags: ['雷', 'ex', 'メガ進化'],
    match: (p) => has(p,'メガゼラオラ ex'),
  },

  // ── 草 ──
  {
    name: 'オーガポン ex（かがやきのめん）',
    priority: 100, tags: ['草', 'ex', 'たね'],
    match: (p) => has(p,'オーガポン ex（かがやきのめん）') || has(p,'オーガポン ex(かがやきのめん)'),
  },
  {
    name: 'ラランテス ex',
    priority: 100, tags: ['草', 'ex', '2進化'],
    match: (p) => has(p,'ラランテス ex'),
  },
  {
    name: 'マスカーニャ ex',
    priority: 100, tags: ['草', 'ex', '2進化'],
    match: (p) => has(p,'マスカーニャ ex'),
  },

  // ── 超 ──
  {
    name: 'サーナイト ex',
    priority: 100, tags: ['超', 'ex', '2進化'],
    match: (p) => has(p,'サーナイト ex') && !has(p,'ピジョット ex'),
  },
  {
    name: 'ドラパルト ex',
    priority: 100, tags: ['超', 'ex', '2進化'],
    match: (p) => has(p,'ドラパルト ex') && !has(p,'ピジョット ex'),
  },
  {
    name: 'ミュウ VMAX',
    priority: 100, tags: ['超', 'VMAX', 'フュージョン'],
    match: (p) => has(p,'ミュウ VMAX') && !has(p,'キュワワー'),
  },
  {
    name: 'ギラティナ VSTAR',
    priority: 100, tags: ['超', 'VSTAR'],
    match: (p) => has(p,'ギラティナ V') && !has(p,'キュワワー') && !has(p,'アルセウス VSTAR'),
  },
  {
    name: 'ハバタクカミ ex',
    priority: 100, tags: ['超', 'ex', 'たね'],
    match: (p) => has(p,'ハバタクカミ ex'),
  },
  {
    name: 'ゲンガー ex',
    priority: 100, tags: ['超', 'ex', '2進化'],
    match: (p) => has(p,'ゲンガー ex'),
  },
  {
    name: 'ニンフィア ex',
    priority: 100, tags: ['超', 'ex', '1進化'],
    match: (p) => has(p,'ニンフィア ex'),
  },
  {
    name: 'ヒスイゾロアーク VSTAR',
    priority: 100, tags: ['無色', 'VSTAR'],
    match: (p) => has(p,'ヒスイゾロアーク VSTAR'),
  },
  {
    name: 'メガシャンデラ ex',
    priority: 100, tags: ['超', 'ex', 'メガ進化'],
    match: (p) => has(p,'メガシャンデラ ex'),
  },

  // ── 闘 ──
  {
    name: 'イダイナキバ ex',
    priority: 100, tags: ['闘', 'ex', 'たね'],
    match: (p) => has(p,'イダイナキバ ex'),
  },
  {
    name: 'オーガポン ex（いしずえのめん）',
    priority: 100, tags: ['闘', 'ex', 'たね'],
    match: (p) => has(p,'オーガポン ex（いしずえのめん）') || has(p,'オーガポン ex(いしずえのめん)'),
  },
  {
    name: 'ガブリアス ex',
    priority: 100, tags: ['ドラゴン', 'ex', '2進化'],
    match: (p) => has(p,'ガブリアス ex'),
  },

  // ── 悪 ──
  {
    name: 'ムゲンダイナ VMAX',
    priority: 100, tags: ['悪', 'VMAX'],
    match: (p) => has(p,'ムゲンダイナ VMAX') && !has(p,'ガラルファイヤー V'),
  },
  {
    name: 'ガラルファイヤー V',
    priority: 100, tags: ['悪', 'V', 'たね'],
    match: (p) => has(p,'ガラルファイヤー V') && !has(p,'ムゲンダイナ VMAX'),
  },
  {
    name: 'メガアブソル ex',
    priority: 100, tags: ['悪', 'ex', 'メガ進化'],
    match: (p) => has(p,'メガアブソル ex'),
  },
  {
    name: 'コノヨザル ex',
    priority: 100, tags: ['悪', 'ex', '1進化'],
    match: (p) => has(p,'コノヨザル ex'),
  },

  // ── 鋼 ──
  {
    name: 'ディアルガ VSTAR',
    priority: 100, tags: ['鋼', 'VSTAR'],
    match: (p) => has(p,'ディアルガ VSTAR') && !has(p,'パルキア VSTAR'),
  },
  {
    name: 'ザシアン V',
    priority: 100, tags: ['鋼', 'V', 'たね'],
    match: (p) => has(p,'ザシアン V'),
  },
  {
    name: 'メタグロス ex',
    priority: 100, tags: ['鋼', 'ex', '2進化'],
    match: (p) => has(p,'メタグロス ex'),
  },
  {
    name: 'ジュラルドン VMAX',
    priority: 100, tags: ['鋼', 'VMAX'],
    match: (p) => has(p,'ジュラルドン VMAX'),
  },
  {
    name: 'テツノブジン ex',
    priority: 100, tags: ['鋼', 'ex', 'たね'],
    match: (p) => has(p,'テツノブジン ex'),
  },
  {
    name: 'テツノイバラ ex',
    priority: 100, tags: ['鋼', 'ex', 'たね'],
    match: (p) => has(p,'テツノイバラ ex'),
  },

  // ── ドラゴン ──
  {
    name: 'レジドラゴ VSTAR',
    priority: 100, tags: ['ドラゴン', 'VSTAR'],
    match: (p) => has(p,'レジドラゴ VSTAR'),
  },
  {
    name: 'ヌメルゴン VSTAR',
    priority: 100, tags: ['ドラゴン', 'VSTAR'],
    match: (p) => has(p,'ヌメルゴン VSTAR'),
  },
  {
    name: 'ビリジオン ex',
    priority: 100, tags: ['ドラゴン', 'ex', 'たね'],
    match: (p) => has(p,'ビリジオン ex'),
  },

  // ── 無色 ──
  {
    name: 'ルギア VSTAR',
    priority: 100, tags: ['無色', 'VSTAR', 'アーケオス'],
    match: (p) => has(p,'ルギア VSTAR') && !has(p,'アルセウス VSTAR'),
  },
  {
    name: 'アルセウス VSTAR',
    priority: 100, tags: ['無色', 'VSTAR'],
    match: (p) => has(p,'アルセウス VSTAR') && !has(p,'ギラティナ V') && !has(p,'ルギア VSTAR') && !has(p,'パオジアン ex') && !has(p,'ドラパルト ex'),
  },
  {
    name: 'テラパゴス ex',
    priority: 100, tags: ['無色', 'ex', 'たね'],
    match: (p) => has(p,'テラパゴス ex'),
  },
  {
    name: 'ガチグマ ex',
    priority: 100, tags: ['無色', 'ex', 'たね'],
    match: (p) => has(p,'ガチグマ ex') && !has(p,'ピジョット ex'),
  },
  {
    name: 'ウォーグル ex',
    priority: 100, tags: ['無色', 'ex', '1進化'],
    match: (p) => has(p,'ウォーグル ex'),
  },
  {
    name: 'ハピナス V',
    priority: 100, tags: ['無色', 'V', 'たね'],
    match: (p) => has(p,'ハピナス V'),
  },

  // ── コントロール系 ──
  {
    name: 'カビゴン LO',
    priority: 150, tags: ['無色', 'コントロール', 'LO'],
    match: (p, all) => {
      if (!has(p,'カビゴン')) return false;
      const ene = all.filter(c => c.category === 'energy').reduce((s,c) => s+c.count, 0);
      return ene <= 4;
    },
  },
  {
    name: 'ミュウツー V-UNION',
    priority: 150, tags: ['超', 'V-UNION', 'コントロール'],
    match: (p) => has(p,'ミュウツー V-UNION') || has(p,'ミュウツーV-UNION'),
  },

  // ── ピジョット単体（サポート軸） ──
  {
    name: 'ピジョット ex',
    priority: 80, tags: ['無色', 'ex', '2進化', 'サポート'],
    match: (p) => has(p,'ピジョット ex'),
  },
];

/* ============================================================
   メイン判定関数
   ============================================================ */

/**
 * デッキ名を自動判定する
 * @param {Array<{id,name,count,category}>} cards
 * @returns {{ name, confidence, tags, reason, candidates }}
 */
function classifyDeck(cards) {
  if (!cards || cards.length === 0) {
    return { name:'不明', confidence:'low', tags:[], reason:'カードデータなし', candidates:[] };
  }

  const pokemonCards = cards.filter(c => c.category === 'pokemon');

  // 全ルールを評価
  const matched = [];
  for (const rule of RULES) {
    try {
      if (rule.match(pokemonCards, cards)) {
        matched.push(rule);
      }
    } catch (e) { /* skip */ }
  }

  // 優先度でソート
  matched.sort((a, b) => b.priority - a.priority);

  const candidates = matched.slice(0, 5).map(r => ({ name: r.name, score: r.priority }));

  if (matched.length === 0) {
    return classifyUnknown(pokemonCards, cards);
  }

  const best = matched[0];
  let confidence;
  if (matched.length === 1) {
    confidence = 'high';
  } else if (matched[0].priority > matched[1].priority) {
    confidence = 'high';
  } else if (matched.length <= 3) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  const reason = matched.length > 1
    ? `${best.name} として判定（他候補: ${matched.slice(1,3).map(r=>r.name).join('、')}）`
    : `${best.name} として判定`;

  return { name: best.name, confidence, tags: best.tags, reason, candidates };
}

/* ============================================================
   未分類デッキの処理
   ============================================================ */

function classifyUnknown(pokemonCards, allCards) {
  // ex / VSTAR / VMAX / V / GX サフィックスを持つ最多枚数ポケモンを主力と推定
  const keyPatterns = [/ex$/i, /VSTAR$/i, /VMAX$/i, /\sV$/i, /GX$/i, /V-UNION$/i];
  let keyPokemon = null;
  let maxCount = 0;

  for (const card of pokemonCards) {
    const isKey = keyPatterns.some(p => p.test(card.name.trim()));
    if (isKey && card.count > maxCount) {
      maxCount = card.count;
      keyPokemon = card;
    }
  }

  if (!keyPokemon && pokemonCards.length > 0) {
    keyPokemon = pokemonCards.reduce((a, b) => a.count > b.count ? a : b);
  }

  const energyCards = allCards.filter(c => c.category === 'energy');
  const energyTags  = inferEnergyTags(energyCards);
  const totalEnergy = energyCards.reduce((s, c) => s + c.count, 0);
  const strategyTag = totalEnergy <= 3 ? 'コントロール' : 'アタッカー';

  const name = keyPokemon ? keyPokemon.name : '未分類デッキ';

  return {
    name,
    confidence: 'low',
    tags: [...energyTags, strategyTag, '未分類'],
    reason: keyPokemon
      ? `ルール未定義。主力ポケモン「${keyPokemon.name}」(${keyPokemon.count}枚) から推測`
      : 'ルール未定義。主力ポケモンを特定できませんでした',
    candidates: [],
  };
}

function inferEnergyTags(energyCards) {
  const typeMap = {
    '炎': ['炎','ファイヤー','fire'],
    '水': ['水','ウォーター','water'],
    '雷': ['雷','ライトニング','lightning'],
    '草': ['草','グラス','grass'],
    '超': ['超','サイキック','psychic'],
    '闘': ['闘','ファイティング','fighting'],
    '悪': ['悪','ダーク','dark'],
    '鋼': ['鋼','メタル','metal'],
    '無色': ['無色','ノーマル','colorless'],
    'ドラゴン': ['ドラゴン','dragon'],
  };
  const tags = new Set();
  for (const card of energyCards) {
    const n = normalize(card.name);
    for (const [tag, patterns] of Object.entries(typeMap)) {
      if (patterns.some(p => n.includes(normalize(p)))) tags.add(tag);
    }
  }
  return [...tags];
}

/* ============================================================
   公式ページパーサー
   ============================================================ */

function parseOfficialDeckPage(html) {
  const cards = [];
  const categoryMap = {
    deck_pke: 'pokemon', deck_gds: 'goods', deck_tool: 'tool',
    deck_sup: 'supporter', deck_sta: 'stadium', deck_ene: 'energy',
  };

  // window.PCGDECK から名前マップを抽出
  const nameMap = {};
  const nameMapMatch = html.match(/searchItemCardName\s*[:=]\s*(\{[^}]+\})/);
  if (nameMapMatch) {
    try {
      Object.assign(nameMap, JSON.parse(nameMapMatch[1].replace(/'/g, '"')));
    } catch (_) {}
  }

  for (const [inputId, category] of Object.entries(categoryMap)) {
    const regex = new RegExp(`<input[^>]+id=["']${inputId}["'][^>]+value=["']([^"']+)["']`, 'i');
    const match = html.match(regex);
    if (!match) continue;
    for (const entry of match[1].split('-')) {
      const parts = entry.split('_');
      if (parts.length < 2) continue;
      const [id, countStr] = parts;
      const count = parseInt(countStr, 10);
      if (isNaN(count)) continue;
      cards.push({ id, name: nameMap[id] || `カードID:${id}`, count, category });
    }
  }
  return cards;
}

function parsePCGDECK(pcgdeck) {
  const cards = [];
  const categoryMap = {
    deck_pke: 'pokemon', deck_gds: 'goods', deck_tool: 'tool',
    deck_sup: 'supporter', deck_sta: 'stadium', deck_ene: 'energy',
  };
  const nameMap = pcgdeck.searchItemCardName || {};
  for (const [key, category] of Object.entries(categoryMap)) {
    const raw = pcgdeck[key] || '';
    if (!raw) continue;
    for (const entry of raw.split('-')) {
      const parts = entry.split('_');
      if (parts.length < 2) continue;
      const [id, countStr] = parts;
      const count = parseInt(countStr, 10);
      if (isNaN(count)) continue;
      cards.push({ id, name: nameMap[id] || `カードID:${id}`, count, category });
    }
  }
  return cards;
}

/* ============================================================
   使用率集計
   ============================================================ */

function aggregateUsageRates(deckEntries) {
  const total = deckEntries.length;
  const countMap = new Map();

  for (const entry of deckEntries) {
    const result = classifyDeck(entry.cards);
    const key = result.name;
    if (!countMap.has(key)) {
      countMap.set(key, { name: key, count: 0, tags: result.tags, confidence: result.confidence, players: [] });
    }
    const item = countMap.get(key);
    item.count++;
    if (entry.playerName) item.players.push(entry.playerName);
  }

  const summary = [...countMap.values()]
    .map(item => ({ ...item, rate: total > 0 ? Math.round(item.count / total * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count);

  const unclassified = summary.filter(s => s.tags.includes('未分類')).reduce((s, i) => s + i.count, 0);
  return { summary, total, unclassified };
}

/* ============================================================
   エクスポート
   ============================================================ */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classifyDeck, aggregateUsageRates, parseOfficialDeckPage, parsePCGDECK, RULES,
    _utils: { normalize, has, find, totalCount } };
}
if (typeof window !== 'undefined') {
  window.DeckClassifier = { classifyDeck, aggregateUsageRates, parseOfficialDeckPage, parsePCGDECK, DECK_RULES: RULES };
}