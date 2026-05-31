/**
 * GitHub Pages 用ビルドスクリプト — build-pages.js
 * data/*.json を読み込み、docs/ に静的サイトを生成する
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT_DIR    = path.join(__dirname, '..');
const DATA_DIR    = path.join(ROOT_DIR, 'data');
const DOCS_DIR    = path.join(ROOT_DIR, 'docs');
const VIEWER_DIR  = path.join(ROOT_DIR, '..', 'pokemon-deck-viewer');

/* ── docs/ ディレクトリを準備 ── */
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

/* ── データを読み込む ── */
function loadJSON(file, def) {
  try {
    const fp = path.join(DATA_DIR, file);
    if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch (_) {}
  return def;
}

const eventsData = loadJSON('events.json', { events: [], updatedAt: null });
const meta       = loadJSON('meta.json',   { eventCount: 0, updatedAt: null });
const summary    = loadJSON('summary.json',{ topDecks: [] });

/* ── APIエンドポイント用JSONを docs/api/ に配置 ── */
const apiDir = path.join(DOCS_DIR, 'api');
if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });

// /api/events.json（全件）
fs.writeFileSync(
  path.join(apiDir, 'events.json'),
  JSON.stringify(eventsData, null, 2)
);

// /api/meta.json
fs.writeFileSync(
  path.join(apiDir, 'meta.json'),
  JSON.stringify(meta, null, 2)
);

// /api/summary.json
fs.writeFileSync(
  path.join(apiDir, 'summary.json'),
  JSON.stringify(summary, null, 2)
);

// /api/events/ 以下に個別ファイル
const eventsApiDir = path.join(apiDir, 'events');
if (!fs.existsSync(eventsApiDir)) fs.mkdirSync(eventsApiDir, { recursive: true });
for (const ev of (eventsData.events || [])) {
  fs.writeFileSync(
    path.join(eventsApiDir, `${ev.id}.json`),
    JSON.stringify(ev, null, 2)
  );
}

console.log(`[build] API JSONファイル生成: ${(eventsData.events || []).length}件`);

/* ── フロントエンドファイルを docs/ にコピー ── */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

if (fs.existsSync(VIEWER_DIR)) {
  copyDir(VIEWER_DIR, DOCS_DIR);
  console.log('[build] フロントエンドファイルをコピー');
} else {
  console.warn('[build] pokemon-deck-viewer が見つかりません。index.html を生成します。');
}

/* ── index.html を生成（フロントエンドがない場合のフォールバック） ── */
const indexPath = path.join(DOCS_DIR, 'index.html');
if (!fs.existsSync(indexPath)) {
  const updatedAt = meta.updatedAt
    ? new Date(meta.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : '未取得';

  const topDeckRows = (summary.topDecks || []).slice(0, 10).map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>
        <img src="${d.deckImgUrl}" alt="デッキ" loading="lazy"
             onerror="this.style.display='none'"
             style="width:60px;height:40px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:8px;">
        <a href="${d.deckPageUrl}" target="_blank" rel="noopener">${d.deckCode}</a>
      </td>
      <td>${d.count}回</td>
      <td>${d.rate}%</td>
    </tr>`).join('');

  const eventCards = (eventsData.events || []).slice(0, 20).map(ev => {
    const deckImgs = (ev.entries || [])
      .filter(e => e.deckImgUrl)
      .slice(0, 8)
      .map(e => `
        <div class="deck-thumb">
          <a href="${e.deckPageUrl}" target="_blank" rel="noopener">
            <img src="${e.deckImgUrl}" alt="${e.playerName}" loading="lazy"
                 onerror="this.parentElement.parentElement.style.display='none'">
          </a>
          <span class="rank">${e.rank}位</span>
          <span class="player">${e.playerName}</span>
        </div>`).join('');

    return `
      <div class="event-card">
        <div class="event-header">
          <h2><a href="${ev.url}" target="_blank" rel="noopener">${ev.title}</a></h2>
          <div class="event-meta">
            <span>📅 ${ev.date || '日付不明'}</span>
            <span>📍 ${ev.prefecture || ''} ${ev.venue || ''}</span>
            <span>👥 ${(ev.entries || []).length}人</span>
          </div>
        </div>
        <div class="deck-grid">${deckImgs || '<p class="no-deck">デッキ非公開</p>'}</div>
        <a href="${ev.url}" class="more-link" target="_blank" rel="noopener">全結果を見る →</a>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ポケカ大会デッキ一覧</title>
  <style>
    :root {
      --bg: #F8F8F8; --surface: #fff; --border: #E0E0E0;
      --text: #1E1E1E; --muted: #888; --accent: #2D2D2D;
      --font: 'Hiragino Kaku Gothic ProN','Hiragino Sans','Noto Sans JP',sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font); background: var(--bg); color: var(--text); }
    a { color: inherit; }

    /* ヘッダー */
    header { background: var(--accent); color: #fff; padding: 20px; }
    header h1 { font-size: 22px; }
    header p  { font-size: 13px; color: #aaa; margin-top: 4px; }

    /* メイン */
    .container { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }

    /* 更新情報 */
    .meta-bar {
      display: flex; justify-content: space-between; align-items: center;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;
      font-size: 13px; color: var(--muted); flex-wrap: wrap; gap: 8px;
    }
    .meta-bar strong { color: var(--text); font-size: 16px; }
    .refresh-btn {
      padding: 6px 14px; background: var(--accent); color: #fff;
      border: none; border-radius: 6px; font-size: 12px; cursor: pointer;
      text-decoration: none; display: inline-block;
    }

    /* 使用率テーブル */
    .section-title {
      font-size: 16px; font-weight: 700; margin-bottom: 12px;
      padding-bottom: 6px; border-bottom: 2px solid var(--accent);
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 32px; }
    th { background: var(--accent); color: #fff; padding: 8px 12px; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
    tr:hover td { background: var(--bg); }

    /* イベントカード */
    .event-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 20px; margin-bottom: 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    .event-header h2 { font-size: 16px; margin-bottom: 6px; }
    .event-header h2 a:hover { text-decoration: underline; }
    .event-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 12px; color: var(--muted); margin-bottom: 12px; }

    /* デッキグリッド */
    .deck-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px; margin-bottom: 12px;
    }
    .deck-thumb {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 8px; padding: 8px; text-align: center;
    }
    .deck-thumb img { width: 100%; aspect-ratio: 3/2; object-fit: cover; border-radius: 4px; }
    .deck-thumb .rank  { font-size: 11px; font-weight: 700; color: var(--accent); }
    .deck-thumb .player { font-size: 11px; color: var(--muted); }
    .no-deck { font-size: 12px; color: var(--muted); padding: 8px 0; }
    .more-link { font-size: 12px; color: var(--muted); text-decoration: underline; }

    /* フッター */
    footer { background: var(--accent); color: #666; padding: 24px; text-align: center; font-size: 11px; line-height: 1.8; }

    @media (max-width: 480px) {
      .deck-grid { grid-template-columns: repeat(3, 1fr); }
      .event-header h2 { font-size: 14px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>🃏 ポケカ大会デッキ一覧</h1>
      <p>プレイヤーズクラブの大会結果を自動取得・表示しています</p>
    </div>
  </header>

  <main class="container">
    <div class="meta-bar">
      <div>
        <strong>${meta.eventCount || 0}件</strong> の大会データ
        <span style="margin-left:12px">最終更新: ${updatedAt}</span>
      </div>
      <a href="https://players.pokemon-card.com/event/result/list"
         class="refresh-btn" target="_blank" rel="noopener">
        プレイヤーズクラブで確認 →
      </a>
    </div>

    ${summary.topDecks && summary.topDecks.length > 0 ? `
    <h2 class="section-title">📊 全大会デッキ使用率 Top 10</h2>
    <table>
      <thead><tr><th>#</th><th>デッキコード</th><th>使用回数</th><th>使用率</th></tr></thead>
      <tbody>${topDeckRows}</tbody>
    </table>` : ''}

    <h2 class="section-title">🏆 大会一覧</h2>
    ${eventCards || '<p style="color:#888;padding:20px 0">データを取得中です…</p>'}
  </main>

  <footer>
    <p>©Pokémon. ©Nintendo/Creatures Inc./GAME FREAK inc.</p>
    <p>ポケットモンスター・ポケモン・Pokémonは任天堂・クリーチャーズ・ゲームフリークの登録商標です。</p>
    <p>本サイトはファンによる非公式サイトです。</p>
  </footer>
</body>
</html>`;

  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log('[build] index.html 生成完了');
}

/* ── .nojekyll（GitHub Pages用） ── */
fs.writeFileSync(path.join(DOCS_DIR, '.nojekyll'), '');

console.log(`[build] GitHub Pages ビルド完了: ${DOCS_DIR}`);