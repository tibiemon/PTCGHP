/**
 * ============================================================
 * ポケカ大会デッキ一覧サイト — app.js
 *
 * 【アーキテクチャ】
 * プレイヤーズクラブはVue.js SPA + 認証必須APIのため、
 * ブラウザから直接クロスオリジンアクセスは不可。
 * → CORSプロキシ（allorigins.win）経由でHTMLをフェッチ＆パース。
 * → 失敗時はサンプルデータにフォールバック。
 *
 * 【デッキ画像URL】
 * https://www.pokemon-card.com/deck/deckView.php/deckID/{デッキコード}.png
 * ============================================================
 */

'use strict';

/* ============================================================
   定数・設定
   ============================================================ */

const CONFIG = {
  // CORSプロキシ（複数用意してフォールバック）
  PROXY_URLS: [
    'https://api.allorigins.win/get?url=',
    'https://corsproxy.io/?',
  ],
  BASE_URL:        'https://players.pokemon-card.com',
  RESULT_LIST_URL: 'https://players.pokemon-card.com/event/result/list',
  DECK_IMG_BASE:   'https://www.pokemon-card.com/deck/deckView.php/deckID/',
  DECK_PAGE_BASE:  'https://www.pokemon-card.com/deck/confirm.html/deckID/',
  EVENTS_PER_PAGE: 20,   // 1ページあたりの大会表示数
  FETCH_TIMEOUT:   12000, // ms
};

/* ============================================================
   状態管理
   ============================================================ */

const STATE = {
  allEvents:    [],   // 全大会データ
  filtered:     [],   // フィルター後
  currentPage:  1,
  totalPages:   1,
  isLoading:    false,
  lastUpdated:  null,
};

/* ============================================================
   ユーティリティ
   ============================================================ */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setLoading(msg = '読み込み中…') {
  document.getElementById('loading-wrap').style.display = 'flex';
  document.getElementById('loading-text').textContent = msg;
  document.getElementById('error-wrap').style.display = 'none';
  document.getElementById('event-list').innerHTML = '';
  document.getElementById('pagination').style.display = 'none';
}

function hideLoading() {
  document.getElementById('loading-wrap').style.display = 'none';
}

function showError(msg) {
  hideLoading();
  document.getElementById('error-wrap').style.display = 'block';
  document.getElementById('error-msg').textContent = msg;
}

function updateMeta() {
  document.getElementById('event-count').textContent = STATE.filtered.length;
  const now = STATE.lastUpdated
    ? STATE.lastUpdated.toLocaleString('ja-JP')
    : '—';
  document.getElementById('last-updated').textContent = `最終更新：${now}`;
}

/* ============================================================
   CORSプロキシ経由フェッチ
   ============================================================ */

async function fetchViaProxy(targetUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);

  for (const proxy of CONFIG.PROXY_URLS) {
    try {
      const proxyUrl = proxy + encodeURIComponent(targetUrl);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      if (!res.ok) continue;
      const data = await res.json();
      clearTimeout(timer);
      // allorigins は { contents: "..." }、corsproxy は生テキスト
      return data.contents ?? data;
    } catch (e) {
      console.warn(`Proxy ${proxy} failed:`, e.message);
    }
  }
  clearTimeout(timer);
  throw new Error('全プロキシでの取得に失敗しました');
}

/* ============================================================
   イベント一覧ページのパース
   ============================================================ */

/**
 * プレイヤーズクラブのイベント一覧HTMLをパースして大会リストを返す
 * @param {string} html
 * @returns {Array<{id, title, date, league, type, regulation, venue, prefecture, capacity, url}>}
 */
function parseEventListHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const events = [];

  // Vue.js SPAのため、サーバーサイドレンダリングされたデータを探す
  // __NUXT__ や window.__INITIAL_STATE__ などのグローバル変数を探す
  const scripts = doc.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent || '';
    // イベントデータのJSON配列を探す
    const match = text.match(/"result"\s*:\s*(\[[\s\S]*?\])\s*,\s*"count"/);
    if (match) {
      try {
        const result = JSON.parse(match[1]);
        return result.map(normalizeEventData);
      } catch (e) { /* continue */ }
    }
  }

  // フォールバック: HTMLから直接パース（静的レンダリングの場合）
  const items = doc.querySelectorAll('.event-result-list-item, [class*="result-item"], [class*="event-item"]');
  items.forEach(item => {
    const titleEl = item.querySelector('h2, h3, [class*="title"]');
    const linkEl  = item.querySelector('a[href*="/event/detail/"]');
    if (!titleEl || !linkEl) return;

    const href = linkEl.getAttribute('href') || '';
    const idMatch = href.match(/\/event\/detail\/(\d+)/);
    if (!idMatch) return;

    events.push({
      id:          idMatch[1],
      title:       titleEl.textContent.trim(),
      date:        item.querySelector('[class*="date"]')?.textContent.trim() || '',
      league:      detectLeague(titleEl.textContent),
      type:        detectType(titleEl.textContent),
      regulation:  detectRegulation(item.textContent),
      venue:       item.querySelector('[class*="venue"], [class*="place"]')?.textContent.trim() || '',
      prefecture:  item.querySelector('[class*="pref"], [class*="area"]')?.textContent.trim() || '',
      capacity:    '',
      url:         CONFIG.BASE_URL + href,
    });
  });

  return events;
}

function normalizeEventData(raw) {
  return {
    id:         String(raw.id || raw.event_id || ''),
    title:      raw.event_title || raw.title || '',
    date:       raw.event_date || raw.date || '',
    league:     detectLeague(raw.event_title || ''),
    type:       detectType(raw.event_title || ''),
    regulation: raw.regulation || detectRegulation(raw.event_title || ''),
    venue:      raw.venue || '',
    prefecture: raw.prefecture_name || '',
    capacity:   raw.capacity ? String(raw.capacity) : '',
    url:        `${CONFIG.BASE_URL}/event/detail/${raw.id || raw.event_id}/result`,
  };
}

/* ============================================================
   イベント詳細（デッキ結果）のパース
   ============================================================ */

/**
 * イベント詳細ページHTMLをパースして参加者デッキリストを返す
 * @param {string} html
 * @returns {Array<{rank, playerName, area, deckCode, deckImgUrl, deckPageUrl}>}
 */
function parseEventDetailHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const entries = [];

  // スクリプト内のJSONデータを探す
  const scripts = doc.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent || '';
    // デッキコードを含むデータ配列を探す
    const match = text.match(/"result"\s*:\s*(\[[\s\S]*?\])/);
    if (match) {
      try {
        const result = JSON.parse(match[1]);
        return result.map(r => ({
          rank:       r.rank || r.ranking || 0,
          playerName: r.player_name || r.name || '',
          area:       r.prefecture_name || r.area || '',
          deckCode:   r.deck_code || '',
          deckImgUrl: r.deck_code
            ? `${CONFIG.DECK_IMG_BASE}${r.deck_code}.png`
            : '',
          deckPageUrl: r.deck_code
            ? `${CONFIG.DECK_PAGE_BASE}${r.deck_code}/`
            : '',
        }));
      } catch (e) { /* continue */ }
    }
  }

  // フォールバック: HTMLテーブルから直接パース
  // プレイヤーズクラブの結果テーブル構造に対応
  const rows = doc.querySelectorAll('tr, [class*="result-row"], [class*="rank-row"]');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td, [class*="cell"]');
    if (cells.length < 2) return;

    // デッキリンクを探す
    const deckLink = row.querySelector('a[href*="deck_code"], a[href*="deckID"], [class*="deck"] a');
    const deckCode = extractDeckCode(deckLink?.href || row.innerHTML);

    const rankText = cells[0]?.textContent.trim().replace(/[^\d]/g, '');
    const rank = parseInt(rankText, 10) || 0;
    if (!rank) return;

    entries.push({
      rank,
      playerName: cells[1]?.textContent.trim() || '',
      area:       cells[2]?.textContent.trim() || '',
      deckCode,
      deckImgUrl:  deckCode ? `${CONFIG.DECK_IMG_BASE}${deckCode}.png` : '',
      deckPageUrl: deckCode ? `${CONFIG.DECK_PAGE_BASE}${deckCode}/` : '',
    });
  });

  return entries;
}

function extractDeckCode(text) {
  if (!text) return '';
  // デッキコードのパターン: 6文字-6文字-6文字 (英数字)
  const match = text.match(/([A-Za-z0-9]{6}-[A-Za-z0-9]{6}-[A-Za-z0-9]{6})/);
  return match ? match[1] : '';
}

/* ============================================================
   大会種別・リーグ・レギュレーション判定
   ============================================================ */

function detectType(title) {
  if (/チャンピオンズリーグ|CL/.test(title)) return 'cl';
  if (/シティリーグ/.test(title)) return 'city';
  if (/ジャパンチャンピオンシップ|JCS|WCS/.test(title)) return 'cl';
  return 'other';
}

function detectLeague(title) {
  if (/マスター/.test(title)) return 'master';
  if (/シニア/.test(title)) return 'senior';
  if (/ジュニア/.test(title)) return 'junior';
  if (/オープン/.test(title)) return 'open';
  return 'other';
}

function detectRegulation(text) {
  if (/エクストラ/.test(text)) return 'extra';
  if (/スタンダード/.test(text)) return 'standard';
  return 'standard';
}

function getTypeLabel(type) {
  return { cl:'チャンピオンズリーグ', city:'シティリーグ', other:'その他' }[type] || 'その他';
}

function getLeagueLabel(league) {
  return { master:'マスター', senior:'シニア', junior:'ジュニア', open:'オープン', other:'その他' }[league] || '';
}

function getTypeBadgeClass(type) {
  return { cl:'badge--cl', city:'badge--city', other:'badge--other' }[type] || 'badge--other';
}

function getLeagueBadgeClass(league) {
  return { master:'badge--master', senior:'badge--senior', junior:'badge--junior', open:'badge--open' }[league] || '';
}

/* ============================================================
   デッキ名自動判定（deckClassifier.js 統合）
   ============================================================ */

const DC = window.DeckClassifier;

/**
 * デッキコードからデッキ名を判定する
 * デッキコードのみ（カード構成なし）の場合は、
 * コードパターンから推測するか「デッキコード取得済み」と表示
 */
function getDeckLabel(entry) {
  if (!entry.deckCode) return '非公開';
  // カード構成データがある場合は自動判定
  if (entry.cards && entry.cards.length > 0 && DC) {
    const result = DC.classifyDeck(entry.cards);
    return result.name;
  }
  // デッキコードのみの場合はコードを表示
  return `デッキコード: ${entry.deckCode}`;
}

/* ============================================================
   使用率集計
   ============================================================ */

/**
 * エントリリストからデッキ名ベースの使用率を集計
 * デッキコードがある場合はコードをキーに集計
 */
function aggregateByDeckCode(entries) {
  const map = new Map();
  const total = entries.length;

  for (const entry of entries) {
    const key = entry.deckCode || '非公開';
    if (!map.has(key)) {
      map.set(key, {
        deckCode:   entry.deckCode,
        deckImgUrl: entry.deckImgUrl,
        count:      0,
        players:    [],
      });
    }
    const item = map.get(key);
    item.count++;
    item.players.push(entry.playerName);
  }

  return [...map.values()]
    .map(item => ({
      ...item,
      rate: total > 0 ? Math.round(item.count / total * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/* ============================================================
   HTML生成
   ============================================================ */

function rankBadgeClass(rank) {
  if (rank === 1) return 'rank-badge--1st';
  if (rank === 2) return 'rank-badge--2nd';
  if (rank === 3) return 'rank-badge--3rd';
  return '';
}

/**
 * 使用率グラフHTMLを生成
 */
function buildUsageChartHTML(summary, total) {
  if (!summary || summary.length === 0) {
    return '<p class="no-data">使用率データなし</p>';
  }
  const maxCount = summary[0].count;

  return summary.map(item => {
    const barPct = Math.round(item.count / maxCount * 100);
    const isHidden = !item.deckCode || item.deckCode === '非公開';
    return `
      <div class="usage-bar-row">
        <span class="usage-deck-name" title="${esc(item.deckCode || '非公開')}">
          ${item.deckImgUrl
            ? `<img class="usage-deck-thumb" src="${esc(item.deckImgUrl)}" alt="デッキ" loading="lazy" onerror="this.style.display='none'">`
            : '<span class="usage-deck-thumb-placeholder">🃏</span>'
          }
          ${esc(item.deckCode || '非公開')}
        </span>
        <div class="usage-bar-wrap">
          <div class="usage-bar ${isHidden ? 'usage-bar--other' : ''}" style="--pct:${barPct}%">
            <span class="usage-bar__label">${item.rate}%</span>
          </div>
        </div>
        <span class="usage-count">${item.count}人</span>
      </div>
    `;
  }).join('');
}

/**
 * デッキグリッドHTMLを生成
 */
function buildDeckGridHTML(entries) {
  if (!entries || entries.length === 0) {
    return '<p class="no-data">デッキデータなし</p>';
  }

  return entries.map(entry => {
    const hasImg = !!entry.deckImgUrl;
    const hasCode = !!entry.deckCode;

    return `
      <div class="deck-card" data-rank="${entry.rank}">
        <div class="deck-card__rank">
          <span class="rank-badge ${rankBadgeClass(entry.rank)}">${entry.rank}位</span>
        </div>
        <div class="deck-card__img-wrap">
          ${hasImg
            ? `<a href="${esc(entry.deckPageUrl)}" target="_blank" rel="noopener noreferrer" class="deck-img-link">
                 <img
                   src="${esc(entry.deckImgUrl)}"
                   alt="${esc(entry.playerName)}のデッキ"
                   loading="lazy"
                   class="deck-img"
                   onerror="this.parentElement.innerHTML='<div class=deck-img-placeholder><span class=deck-img-placeholder__icon>🃏</span><span class=deck-img-placeholder__text>画像なし</span></div>'"
                 />
               </a>`
            : `<div class="deck-img-placeholder">
                 <span class="deck-img-placeholder__icon">🃏</span>
                 <span class="deck-img-placeholder__text">${hasCode ? 'デッキコードあり' : '非公開'}</span>
               </div>`
          }
        </div>
        <div class="deck-card__info">
          <p class="deck-card__player">
            ${esc(entry.playerName)}
            ${entry.area ? `<span class="deck-card__area">${esc(entry.area)}</span>` : ''}
          </p>
          ${hasCode
            ? `<p class="deck-card__code">${esc(entry.deckCode)}</p>
               <a href="${esc(entry.deckPageUrl)}" class="deck-card__link"
                  target="_blank" rel="noopener noreferrer">デッキをみる →</a>`
            : '<p class="deck-card__code deck-card__code--hidden">非公開</p>'
          }
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 大会カードHTMLを生成
 */
function buildEventCardHTML(event, index) {
  const isFirst = index === 0;
  const entries = event.entries || [];
  const summary = aggregateByDeckCode(entries);
  const total   = entries.length;

  return `
    <article class="event-card"
             data-type="${esc(event.type)}"
             data-league="${esc(event.league)}"
             data-reg="${esc(event.regulation)}">
      <header class="event-card__header">
        <div class="event-card__meta">
          <span class="badge ${getTypeBadgeClass(event.type)}">${esc(getTypeLabel(event.type))}</span>
          ${event.league !== 'other' ? `<span class="badge ${getLeagueBadgeClass(event.league)}">${esc(getLeagueLabel(event.league))}</span>` : ''}
          ${event.regulation === 'extra' ? '<span class="badge badge--extra">エクストラ</span>' : '<span class="badge badge--standard">スタンダード</span>'}
        </div>
        <h2 class="event-card__title">
          <a href="${esc(event.url)}" target="_blank" rel="noopener noreferrer" class="event-title-link">
            ${esc(event.title)}
          </a>
        </h2>
        <div class="event-card__info">
          ${event.date ? `<span class="event-info-item">
            <svg class="icon" viewBox="0 0 16 16"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM7.25 4v4.25l3.5 2.1-.6 1-4.15-2.5V4h1.25z"/></svg>
            ${esc(event.date)}
          </span>` : ''}
          ${event.prefecture ? `<span class="event-info-item">
            <svg class="icon" viewBox="0 0 16 16"><path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 1 1 8 4a1.5 1.5 0 0 1 0 3z"/></svg>
            ${esc(event.prefecture)} ${esc(event.venue)}
          </span>` : ''}
          ${event.capacity ? `<span class="event-info-item">
            <svg class="icon" viewBox="0 0 16 16"><path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1zm0 1.5L11.5 5H9V2.5zM4 14V2h4v4h4v8H4z"/></svg>
            定員 ${esc(event.capacity)}人
          </span>` : ''}
          <span class="event-info-item">
            <svg class="icon" viewBox="0 0 16 16"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zM6 8a2 2 0 114 0 2 2 0 01-4 0z"/></svg>
            参加 ${total}人分のデッキ
          </span>
        </div>
        <button class="event-card__toggle"
                aria-expanded="${isFirst}"
                aria-controls="event-body-${index}">
          <span class="toggle-text">${isFirst ? '閉じる' : '開く'}</span>
          <svg class="toggle-icon ${isFirst ? '' : 'toggle-icon--collapsed'}" viewBox="0 0 16 16">
            <path d="M8 10.5L2.5 5l1-1L8 8.5 12.5 4l1 1z"/>
          </svg>
        </button>
      </header>

      <div class="event-card__body ${isFirst ? '' : 'is-collapsed'}" id="event-body-${index}">

        <!-- 使用率グラフ -->
        <section class="usage-section">
          <div class="usage-section__header">
            <h3 class="section-title">デッキ使用率</h3>
            <span class="usage-badge">デッキコード別</span>
          </div>
          <div class="usage-chart">
            ${buildUsageChartHTML(summary, total)}
          </div>
        </section>

        <!-- デッキ画像グリッド -->
        <section class="deck-section">
          <div class="deck-section__header">
            <h3 class="section-title">使用デッキ一覧</h3>
            <div class="deck-controls">
              <div class="view-toggle" role="group" aria-label="表示切替">
                <button class="view-toggle__btn is-active" data-view="grid" title="グリッド表示">
                  <svg viewBox="0 0 16 16"><path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z"/></svg>
                </button>
                <button class="view-toggle__btn" data-view="list" title="リスト表示">
                  <svg viewBox="0 0 16 16"><path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z"/></svg>
                </button>
              </div>
            </div>
          </div>
          <div class="rank-tabs" role="tablist">
            <button class="rank-tab is-active" role="tab" data-rank="all">全順位</button>
            <button class="rank-tab" role="tab" data-rank="top8">Top 8</button>
            <button class="rank-tab" role="tab" data-rank="top16">Top 16</button>
            <button class="rank-tab" role="tab" data-rank="top32">Top 32</button>
          </div>
          <div class="deck-grid">
            ${buildDeckGridHTML(entries)}
          </div>
          <div class="event-source-link">
            <a href="${esc(event.url)}" target="_blank" rel="noopener noreferrer">
              プレイヤーズクラブで全結果を見る →
            </a>
          </div>
        </section>

      </div>
    </article>
  `;
}

/* ============================================================
   イベントリスト描画
   ============================================================ */

function renderEventList() {
  const list = document.getElementById('event-list');
  const start = (STATE.currentPage - 1) * CONFIG.EVENTS_PER_PAGE;
  const pageEvents = STATE.filtered.slice(start, start + CONFIG.EVENTS_PER_PAGE);

  if (pageEvents.length === 0) {
    list.innerHTML = '<p class="no-data" style="padding:32px 0;text-align:center;">該当する大会がありません</p>';
    document.getElementById('pagination').style.display = 'none';
    return;
  }

  list.innerHTML = pageEvents.map((ev, i) => buildEventCardHTML(ev, i)).join('');

  // ページネーション
  STATE.totalPages = Math.ceil(STATE.filtered.length / CONFIG.EVENTS_PER_PAGE);
  const pag = document.getElementById('pagination');
  pag.style.display = STATE.totalPages > 1 ? 'flex' : 'none';
  document.getElementById('page-info').textContent = `${STATE.currentPage} / ${STATE.totalPages}`;
  document.getElementById('page-prev').disabled = STATE.currentPage <= 1;
  document.getElementById('page-next').disabled = STATE.currentPage >= STATE.totalPages;

  // イベントを再バインド
  bindCardEvents();
  updateMeta();
}

/* ============================================================
   イベントバインド（カード内インタラクション）
   ============================================================ */

function bindCardEvents() {
  // 折りたたみトグル
  document.querySelectorAll('.event-card__toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('aria-controls');
      const body = document.getElementById(targetId);
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isExpanded));
      btn.querySelector('.toggle-text').textContent = isExpanded ? '開く' : '閉じる';
      btn.querySelector('.toggle-icon').classList.toggle('toggle-icon--collapsed', isExpanded);
      body.classList.toggle('is-collapsed', isExpanded);
    });
  });

  // 表示切替（グリッド/リスト）
  document.querySelectorAll('.view-toggle').forEach(group => {
    const btns = group.querySelectorAll('.view-toggle__btn');
    const grid = group.closest('.deck-section').querySelector('.deck-grid');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        grid.classList.toggle('deck-grid--list', btn.dataset.view === 'list');
      });
    });
  });

  // 順位タブ
  document.querySelectorAll('.rank-tabs').forEach(tabGroup => {
    const tabs = tabGroup.querySelectorAll('.rank-tab');
    const grid = tabGroup.closest('.deck-section').querySelector('.deck-grid');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const rank = tab.dataset.rank;
        grid.querySelectorAll('.deck-card').forEach(card => {
          const r = parseInt(card.dataset.rank, 10);
          let show = true;
          if (rank === 'top8')  show = r <= 8;
          if (rank === 'top16') show = r <= 16;
          if (rank === 'top32') show = r <= 32;
          card.style.display = show ? '' : 'none';
        });
      });
    });
  });
}

/* ============================================================
   フィルター
   ============================================================ */

function applyFilters() {
  const type    = document.getElementById('filter-type').value;
  const league  = document.getElementById('filter-league').value;
  const reg     = document.getElementById('filter-reg').value;
  const keyword = document.getElementById('filter-keyword').value.trim().toLowerCase();

  STATE.filtered = STATE.allEvents.filter(ev => {
    const matchType    = type   === 'all' || ev.type   === type;
    const matchLeague  = league === 'all' || ev.league === league;
    const matchReg     = reg    === 'all' || ev.regulation === reg;
    const matchKeyword = !keyword ||
      ev.title.toLowerCase().includes(keyword) ||
      ev.prefecture.toLowerCase().includes(keyword) ||
      ev.venue.toLowerCase().includes(keyword);
    return matchType && matchLeague && matchReg && matchKeyword;
  });

  STATE.currentPage = 1;
  renderEventList();
}

/* ============================================================
   データ取得メイン
   ============================================================ */

/**
 * プレイヤーズクラブからイベント一覧を取得
 * CORSプロキシ経由でHTMLをフェッチしてパース
 */
async function fetchEventList(page = 1) {
  const url = `${CONFIG.RESULT_LIST_URL}?page=${page}`;
  setLoading(`大会一覧を取得中（${page}ページ目）…`);

  try {
    const html = await fetchViaProxy(url);
    const events = parseEventListHTML(html);

    if (events.length === 0) {
      throw new Error('大会データを取得できませんでした（サイト構造が変更された可能性があります）');
    }

    return events;
  } catch (e) {
    throw e;
  }
}

/**
 * イベント詳細（デッキ結果）を取得
 */
async function fetchEventDetail(event) {
  try {
    const html = await fetchViaProxy(event.url);
    const entries = parseEventDetailHTML(html);
    return { ...event, entries };
  } catch (e) {
    console.warn(`イベント詳細取得失敗: ${event.title}`, e);
    return { ...event, entries: [] };
  }
}

/**
 * メインのデータ読み込み処理
 * 複数ページを並列取得してイベント一覧を構築
 */
async function loadData(pagesToFetch = 3) {
  if (STATE.isLoading) return;
  STATE.isLoading = true;

  try {
    setLoading('大会一覧を取得中…');

    // 複数ページを並列取得
    const pagePromises = [];
    for (let p = 1; p <= pagesToFetch; p++) {
      pagePromises.push(fetchEventList(p).catch(() => []));
    }

    const pages = await Promise.all(pagePromises);
    const allEvents = pages.flat();

    if (allEvents.length === 0) {
      throw new Error('大会データが取得できませんでした');
    }

    setLoading(`${allEvents.length}件の大会のデッキ情報を取得中…`);

    // 各イベントの詳細を並列取得（最大10件同時）
    const BATCH = 10;
    const eventsWithDetails = [];
    for (let i = 0; i < allEvents.length; i += BATCH) {
      const batch = allEvents.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(ev => fetchEventDetail(ev)));
      eventsWithDetails.push(...results);
      document.getElementById('loading-text').textContent =
        `デッキ情報を取得中… ${Math.min(i + BATCH, allEvents.length)} / ${allEvents.length}件`;
    }

    STATE.allEvents   = eventsWithDetails;
    STATE.filtered    = eventsWithDetails;
    STATE.lastUpdated = new Date();
    STATE.currentPage = 1;

    hideLoading();
    renderEventList();

  } catch (e) {
    console.error('データ取得エラー:', e);
    showError(e.message);
  } finally {
    STATE.isLoading = false;
  }
}

/* ============================================================
   サンプルデータ（フォールバック）
   ============================================================ */

const SAMPLE_EVENTS = [
  {
    id: '952934', title: 'シティリーグ2026 シーズン4 オープンリーグ（横浜伊勢佐木町）',
    date: '2026年05月03日（日）11:30〜19:00', league: 'open', type: 'city',
    regulation: 'standard', venue: 'トーナメントセンターバトロコ 横浜伊勢佐木町',
    prefecture: '神奈川県', capacity: '64',
    url: 'https://players.pokemon-card.com/event/detail/952934/result',
    entries: [
      { rank:1, playerName:'モト',      area:'神奈川県', deckCode:'PigQnL-WDTJAj-ggg9nQ',
        deckImgUrl:'https://www.pokemon-card.com/deck/deckView.php/deckID/PigQnL-WDTJAj-ggg9nQ.png',
        deckPageUrl:'https://www.pokemon-card.com/deck/confirm.html/deckID/PigQnL-WDTJAj-ggg9nQ/' },
      { rank:2, playerName:'リリー',    area:'埼玉県',   deckCode:'8cDcDc-n7YAKe-8x8JYx',
        deckImgUrl:'https://www.pokemon-card.com/deck/deckView.php/deckID/8cDcDc-n7YAKe-8x8JYx.png',
        deckPageUrl:'https://www.pokemon-card.com/deck/confirm.html/deckID/8cDcDc-n7YAKe-8x8JYx/' },
      { rank:3, playerName:'マキ',      area:'神奈川県', deckCode:'Yxcc8G-zQJ1pO-xxYx8x',
        deckImgUrl:'https://www.pokemon-card.com/deck/deckView.php/deckID/Yxcc8G-zQJ1pO-xxYx8x.png',
        deckPageUrl:'https://www.pokemon-card.com/deck/confirm.html/deckID/Yxcc8G-zQJ1pO-xxYx8x/' },
      { rank:3, playerName:'ま',        area:'徳島県',   deckCode:'g9QLnL-PA8zEE-QgL6nN',
        deckImgUrl:'https://www.pokemon-card.com/deck/deckView.php/deckID/g9QLnL-PA8zEE-QgL6nN.png',
        deckPageUrl:'https://www.pokemon-card.com/deck/confirm.html/deckID/g9QLnL-PA8zEE-QgL6nN/' },
      { rank:5, playerName:'まさと',    area:'神奈川県', deckCode:'py2pSM-R9dR2E-2SUMMM',
        deckImgUrl:'https://www.pokemon-card.com/deck/deckView.php/deckID/py2pSM-R9dR2E-2SUMMM.png',
        deckPageUrl:'https://www.pokemon-card.com/deck/confirm.html/deckID/py2pSM-R9dR2E-2SUMMM/' },
      { rank:5, playerName:'Nameless', area:'神奈川県', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:5, playerName:'さおはんま',area:'東京都',   deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:5, playerName:'zume84zume',area:'神奈川県',deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
    ],
  },
  {
    id: '953201', title: 'シティリーグ2026 シーズン4 シニアリーグ（鹿角ラボ）',
    date: '2026年04月29日（水）09:45〜17:00', league: 'senior', type: 'city',
    regulation: 'standard', venue: '道の駅かづの あんとらあ 多目的ホール',
    prefecture: '秋田県', capacity: '32',
    url: 'https://players.pokemon-card.com/event/detail/953201/result',
    entries: [
      { rank:1, playerName:'そうた', area:'東京都',   deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:2, playerName:'a',      area:'新潟県',   deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:3, playerName:'まさ',   area:'秋田県',   deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:3, playerName:'kinpei', area:'秋田県',   deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
    ],
  },
  {
    id: '952812', title: 'シティリーグ2026 シーズン4 オープンリーグ（ドラゴンスター池袋店）',
    date: '2026年04月17日（金）13:00〜18:00', league: 'open', type: 'city',
    regulation: 'standard', venue: 'ドラゴンスター池袋店',
    prefecture: '東京都', capacity: '64',
    url: 'https://players.pokemon-card.com/event/detail/952812/result',
    entries: [
      { rank:1, playerName:'Goto',    area:'東京都', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:2, playerName:'こうき',  area:'東京都', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:3, playerName:'ポプサン',area:'東京都', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:3, playerName:'がおがお',area:'東京都', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:5, playerName:'スバル',  area:'東京都', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:5, playerName:'まろ',    area:'埼玉県', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:5, playerName:'あきら',  area:'東京都', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:5, playerName:'こへあつ',area:'東京都', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
    ],
  },
  {
    id: '849961',
    title: 'チャンピオンズリーグ2026 愛知 Dec. シニアリーグ 1日目大会',
    date: '2025年12月06日（土）07:30〜20:45', league: 'senior', type: 'cl',
    regulation: 'standard', venue: 'Aichi Sky Expo 展示ホールC・D',
    prefecture: '愛知県', capacity: '1000',
    url: 'https://players.pokemon-card.com/event/detail/849961/result',
    entries: [
      { rank:1, playerName:'エミヤ',      area:'熊本県',   deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:2, playerName:'ベーベノーム', area:'愛知県',   deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:3, playerName:'だらる',      area:'神奈川県', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:3, playerName:'ユサ',        area:'神奈川県', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:5, playerName:'タマネギ',    area:'神奈川県', deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:5, playerName:'たくみ',      area:'大阪府',   deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:5, playerName:'もち',        area:'京都府',   deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
      { rank:5, playerName:'チョコB',     area:'東京都',   deckCode:'',
        deckImgUrl:'', deckPageUrl:'' },
    ],
  },
];

function loadSampleData() {
  STATE.allEvents   = SAMPLE_EVENTS;
  STATE.filtered    = SAMPLE_EVENTS;
  STATE.lastUpdated = new Date();
  STATE.currentPage = 1;
  document.getElementById('error-wrap').style.display = 'none';
  hideLoading();
  renderEventList();
}

/* ============================================================
   ページネーション
   ============================================================ */

document.getElementById('page-prev').addEventListener('click', () => {
  if (STATE.currentPage > 1) {
    STATE.currentPage--;
    renderEventList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

document.getElementById('page-next').addEventListener('click', () => {
  if (STATE.currentPage < STATE.totalPages) {
    STATE.currentPage++;
    renderEventList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

/* ============================================================
   フィルターバー
   ============================================================ */

['filter-type','filter-league','filter-reg'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', applyFilters);
});
document.getElementById('filter-keyword')?.addEventListener('input', applyFilters);

/* ============================================================
   更新ボタン
   ============================================================ */

document.getElementById('btn-reload').addEventListener('click', () => {
  loadData(3);
});

/* ============================================================
   サンプルデータボタン
   ============================================================ */

document.getElementById('btn-load-sample').addEventListener('click', loadSampleData);

/* ============================================================
   リスト表示用スタイル（動的追加）
   ============================================================ */

const listStyle = document.createElement('style');
listStyle.textContent = `
  .deck-grid--list { grid-template-columns: 1fr !important; }
  .deck-grid--list .deck-card { flex-direction: row; align-items: center; }
  .deck-grid--list .deck-card__rank {
    padding: 8px; border-bottom: none; border-right: 1px solid var(--color-border);
    min-width: 56px; text-align: center; align-self: stretch;
    display: flex; align-items: center; justify-content: center;
  }
  .deck-grid--list .deck-card__img-wrap { width: 80px; min-width: 80px; flex-shrink: 0; }
  .deck-grid--list .deck-card__info { flex-direction: row; align-items: center; gap: 12px; flex-wrap: wrap; }
  @media (max-width: 480px) {
    .deck-grid--list .deck-card__img-wrap { width: 60px; min-width: 60px; }
  }
`;
document.head.appendChild(listStyle);

/* ============================================================
   初期化 — ページロード時に自動でデータ取得を試みる
   ============================================================ */

(async () => {
  try {
    await loadData(3);
  } catch (e) {
    // loadData内でエラー処理済み
  }
})();