/**
 * deckClassifier.js v2 — ユニットテスト
 * 実行: node deckClassifier.test.js
 */
'use strict';

const { classifyDeck, aggregateUsageRates, _utils: { normalize, has } } = require('./deckClassifier');

let passed = 0, failed = 0;

function test(label, fn) {
  try { fn(); console.log(`  ✅ ${label}`); passed++; }
  catch(e) { console.error(`  ❌ ${label}\n     → ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected "${b}", got "${a}"`); }

/* ── テストデータ ── */
const mk = (name, count, category='pokemon') => ({ id: name, name, count, category });

const rizardonPijot = [
  mk('リザードン ex', 3), mk('リザード', 2), mk('ヒトカゲ', 4),
  mk('ピジョット ex', 2), mk('ピジョン', 1), mk('ポッポ', 2),
  mk('基本炎エネルギー', 10, 'energy'),
];
const rizardonSingle = [
  mk('リザードン ex', 3), mk('リザード', 2), mk('ヒトカゲ', 4),
  mk('基本炎エネルギー', 10, 'energy'),
];
const lugia = [
  mk('ルギア VSTAR', 3), mk('ルギア V', 4), mk('アーケオス', 4),
  mk('基本無色エネルギー', 8, 'energy'),
];
const lostBullet = [
  mk('ウッウ', 3), mk('キュワワー', 4), mk('ヤミラミ', 2),
  mk('かがやくゲッコウガ', 1),
  mk('基本水エネルギー', 4, 'energy'), mk('基本超エネルギー', 3, 'energy'),
];
const lostGiratina = [
  mk('ギラティナ V', 4), mk('ギラティナ VSTAR', 3), mk('キュワワー', 4), mk('ウッウ', 2),
  mk('基本超エネルギー', 8, 'energy'),
];
const lostMew = [
  mk('ミュウ VMAX', 3), mk('ミュウ V', 4), mk('キュワワー', 4), mk('ウッウ', 2),
  mk('基本超エネルギー', 8, 'energy'),
];
const paojian = [
  mk('パオジアン ex', 3), mk('セグレイブ', 3), mk('セゴール', 2), mk('チョッパー', 4),
  mk('基本水エネルギー', 12, 'energy'),
];
const paojianSingle = [
  mk('パオジアン ex', 3), mk('チョッパー', 4),
  mk('基本水エネルギー', 12, 'energy'),
];
const arceus = [
  mk('アルセウス VSTAR', 3), mk('アルセウス V', 4),
  mk('基本無色エネルギー', 8, 'energy'),
];
const arceusGiratina = [
  mk('アルセウス VSTAR', 3), mk('アルセウス V', 4),
  mk('ギラティナ V', 3), mk('ギラティナ VSTAR', 2),
  mk('基本超エネルギー', 8, 'energy'),
];
const kabigonLO = [
  mk('カビゴン', 4), mk('ヤレユータン', 2), mk('ワタシラガ V', 2),
  mk('基本無色エネルギー', 2, 'energy'),
];
const saranaito = [
  mk('サーナイト ex', 3), mk('キルリア', 3), mk('ラルトス', 4),
  mk('基本超エネルギー', 8, 'energy'),
];
const saranaitoPijot = [
  mk('サーナイト ex', 3), mk('キルリア', 3), mk('ラルトス', 4),
  mk('ピジョット ex', 2), mk('ピジョン', 1), mk('ポッポ', 2),
  mk('基本超エネルギー', 8, 'energy'),
];
const drapalut = [
  mk('ドラパルト ex', 3), mk('ドロンチ', 2), mk('ドラメシヤ', 4),
  mk('基本超エネルギー', 10, 'energy'),
];
const miraidon = [
  mk('ミライドン ex', 3), mk('テツノカシラ ex', 2),
  mk('基本雷エネルギー', 10, 'energy'),
];
const tetsunokaina = [
  mk('テツノカイナ ex', 3), mk('ネオラントV', 1),
  mk('基本雷エネルギー', 10, 'energy'),
];
const kainaMiraidon = [
  mk('テツノカイナ ex', 3), mk('ミライドン ex', 3),
  mk('基本雷エネルギー', 10, 'energy'),
];
const unknown = [
  mk('フシギバナ ex', 3), mk('フシギソウ', 2), mk('フシギダネ', 4),
  mk('基本草エネルギー', 12, 'energy'),
];

console.log('\n========================================');
console.log('  deckClassifier.js v2 — テスト開始');
console.log('========================================\n');

// ── normalize ──
console.log('【normalize / has】');
test('全角英数を半角に変換', () => assertEqual(normalize('ＡＢＣ'), 'abc'));
test('スペース除去', () => assertEqual(normalize('  test  '), 'test'));
test('has: 部分一致', () => assert(has([mk('リザードン ex',3)], 'リザードン ex')));
test('has: 不一致', () => assert(!has([mk('ルギア VSTAR',3)], 'リザードン')));

// ── 複合デッキ ──
console.log('\n【複合デッキ判定】');
test('リザードン＆ピジョット', () => assertEqual(classifyDeck(rizardonPijot).name, 'リザードン＆ピジョット'));
test('パオジアン＆セグレイブ', () => assertEqual(classifyDeck(paojian).name, 'パオジアン＆セグレイブ'));
test('アルセウス＆ギラティナ', () => assertEqual(classifyDeck(arceusGiratina).name, 'アルセウス＆ギラティナ'));
test('ロストギラティナ', () => assertEqual(classifyDeck(lostGiratina).name, 'ロストギラティナ'));
test('ロストミュウ', () => assertEqual(classifyDeck(lostMew).name, 'ロストミュウ'));
test('ロストバレット（ギラティナなし）', () => assertEqual(classifyDeck(lostBullet).name, 'ロストバレット'));
test('テツノカイナ＆ミライドン', () => assertEqual(classifyDeck(kainaMiraidon).name, 'テツノカイナ＆ミライドン'));
test('サーナイト＆ピジョット', () => assertEqual(classifyDeck(saranaitoPijot).name, 'サーナイト＆ピジョット'));

// ── 単体デッキ ──
console.log('\n【単体デッキ判定】');
test('リザードン ex（単体）', () => assertEqual(classifyDeck(rizardonSingle).name, 'リザードン ex'));
test('ルギア VSTAR', () => assertEqual(classifyDeck(lugia).name, 'ルギア VSTAR'));
test('パオジアン ex（単体）', () => assertEqual(classifyDeck(paojianSingle).name, 'パオジアン ex'));
test('アルセウス VSTAR（単体）', () => assertEqual(classifyDeck(arceus).name, 'アルセウス VSTAR'));
test('サーナイト ex（単体）', () => assertEqual(classifyDeck(saranaito).name, 'サーナイト ex'));
test('ドラパルト ex', () => assertEqual(classifyDeck(drapalut).name, 'ドラパルト ex'));
test('ミライドン ex', () => assertEqual(classifyDeck(miraidon).name, 'ミライドン ex'));
test('テツノカイナ ex（単体）', () => assertEqual(classifyDeck(tetsunokaina).name, 'テツノカイナ ex'));
test('カビゴン LO（エネルギー少）', () => assertEqual(classifyDeck(kabigonLO).name, 'カビゴン LO'));

// ── 信頼度 ──
console.log('\n【信頼度】');
test('複合デッキは high', () => assertEqual(classifyDeck(arceusGiratina).confidence, 'high'));
test('単体デッキは high', () => assertEqual(classifyDeck(lugia).confidence, 'high'));
test('未分類は low', () => assertEqual(classifyDeck(unknown).confidence, 'low'));

// ── 未分類 ──
console.log('\n【未分類デッキ】');
test('未分類は主力ポケモン名を返す', () => {
  const r = classifyDeck(unknown);
  assert(r.name.includes('フシギバナ'), `name="${r.name}"`);
});
test('未分類タグを含む', () => assert(classifyDeck(unknown).tags.includes('未分類')));
test('空リストは "不明"', () => assertEqual(classifyDeck([]).name, '不明'));
test('null は "不明"', () => assertEqual(classifyDeck(null).name, '不明'));

// ── 出力形式 ──
console.log('\n【出力形式】');
test('tags が配列', () => assert(Array.isArray(classifyDeck(lugia).tags)));
test('reason が文字列', () => assert(typeof classifyDeck(lugia).reason === 'string'));
test('candidates が配列', () => assert(Array.isArray(classifyDeck(lugia).candidates)));

// ── 集計 ──
console.log('\n【aggregateUsageRates】');
const eventDecks = [
  { cards: rizardonPijot, playerName: 'A', rank: 1 },
  { cards: rizardonPijot, playerName: 'B', rank: 2 },
  { cards: lugia,         playerName: 'C', rank: 3 },
  { cards: lostBullet,    playerName: 'D', rank: 5 },
  { cards: unknown,       playerName: 'E', rank: 5 },
];
test('合計件数', () => assertEqual(aggregateUsageRates(eventDecks).total, 5));
test('最多デッキが先頭', () => assertEqual(aggregateUsageRates(eventDecks).summary[0].name, 'リザードン＆ピジョット'));
test('プレイヤー名が記録される', () => {
  const { summary } = aggregateUsageRates(eventDecks);
  const r = summary.find(s => s.name === 'リザードン＆ピジョット');
  assert(r.players.includes('A') && r.players.includes('B'));
});

console.log('\n========================================');
console.log(`  結果: ${passed} 件成功 / ${failed} 件失敗`);
console.log('========================================\n');
if (failed > 0) process.exit(1);