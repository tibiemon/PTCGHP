/**
 * データ検証スクリプト — validate.js
 * GitHub Actions の「データ検証」ステップで実行
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

let errors   = 0;
let warnings = 0;

function check(cond, msg, isWarn = false) {
  if (!cond) {
    if (isWarn) { console.warn(`  ⚠️  ${msg}`); warnings++; }
    else        { console.error(`  ❌ ${msg}`); errors++; }
  } else {
    console.log(`  ✅ ${msg}`);
  }
}

console.log('\n=== データ検証開始 ===\n');

// ── events.json ──
console.log('【events.json】');
const evFile = path.join(DATA_DIR, 'events.json');
check(fs.existsSync(evFile), 'ファイルが存在する');

if (fs.existsSync(evFile)) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(evFile, 'utf-8'));
    check(true, 'JSONパース成功');
  } catch (e) {
    check(false, `JSONパース失敗: ${e.message}`);
    process.exit(1);
  }

  check(Array.isArray(data.events), 'events が配列');
  check(data.events.length > 0, `イベント件数 > 0 (実際: ${data.events.length}件)`);
  check(typeof data.updatedAt === 'string', 'updatedAt が文字列');

  if (data.events.length > 0) {
    const ev = data.events[0];
    check(typeof ev.id === 'string' && ev.id.length > 0, '最初のイベントにIDがある');
    check(typeof ev.title === 'string' && ev.title.length > 0, '最初のイベントにタイトルがある');
    check(Array.isArray(ev.entries), '最初のイベントにentriesがある');

    // デッキコードの形式チェック
    const deckCodePattern = /^[A-Za-z0-9]{6}-[A-Za-z0-9]{6}-[A-Za-z0-9]{6}$/;
    const entriesWithCode = ev.entries.filter(e => e.deckCode);
    const validCodes = entriesWithCode.filter(e => deckCodePattern.test(e.deckCode));
    if (entriesWithCode.length > 0) {
      check(
        validCodes.length === entriesWithCode.length,
        `デッキコード形式が正しい (${validCodes.length}/${entriesWithCode.length}件)`,
        true
      );
    }

    // 重複IDチェック
    const ids = data.events.map(e => e.id);
    const uniqueIds = new Set(ids);
    check(ids.length === uniqueIds.size, `重複IDなし (${ids.length}件)`);

    // ソート順チェック（IDの降順）
    let sorted = true;
    for (let i = 1; i < Math.min(data.events.length, 10); i++) {
      if (parseInt(data.events[i-1].id) < parseInt(data.events[i].id)) {
        sorted = false; break;
      }
    }
    check(sorted, 'IDの降順でソートされている', true);
  }
}

// ── meta.json ──
console.log('\n【meta.json】');
const metaFile = path.join(DATA_DIR, 'meta.json');
check(fs.existsSync(metaFile), 'ファイルが存在する');
if (fs.existsSync(metaFile)) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
    check(true, 'JSONパース成功');
    check(typeof meta.updatedAt === 'string', 'updatedAt が存在する');
    check(typeof meta.eventCount === 'number', `eventCount が数値 (${meta.eventCount}件)`);
  } catch (e) {
    check(false, `JSONパース失敗: ${e.message}`);
  }
}

// ── summary.json ──
console.log('\n【summary.json】');
const summaryFile = path.join(DATA_DIR, 'summary.json');
check(fs.existsSync(summaryFile), 'ファイルが存在する', true);
if (fs.existsSync(summaryFile)) {
  try {
    const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
    check(true, 'JSONパース成功');
    check(Array.isArray(summary.topDecks), 'topDecks が配列', true);
  } catch (e) {
    check(false, `JSONパース失敗: ${e.message}`, true);
  }
}

// ── 結果 ──
console.log(`\n=== 検証結果: ${errors}件のエラー, ${warnings}件の警告 ===\n`);
if (errors > 0) {
  console.error('検証失敗。ワークフローを中断します。');
  process.exit(1);
}
console.log('検証成功。');