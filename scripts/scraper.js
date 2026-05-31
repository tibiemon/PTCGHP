/**
 * GitHub Actions 用スクレイパー v2
 */
'use strict';

const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const { URL } = require('url');

const CONFIG = {
  BASE_URL:       'https://players.pokemon-card.com',
  DECK_IMG_BASE:  'https://www.pokemon-card.com/deck/deckView.php/deckID/',
  DECK_PAGE_BASE: 'https://www.pokemon-card.com/deck/confirm.html/deckID/',
  DATA_DIR:       path.join(__dirname, '..', 'data'),
  REQUEST_DELAY:  1200,
  TIMEOUT:        20000,
  PER_PAGE:       32,
  MAX_CONSECUTIVE_FAILS: 15,
};

const ARGS = {};
process.argv.slice(2).forEach(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  ARGS[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v ?? true;
});

const MODE       = ARGS.mode       || 'diff';
const MAX_EVENTS = parseInt(ARGS.maxEvents || '20', 10);
const START_ID   = ARGS.startId ? parseInt(ARGS.startId, 10) : null;

console.log(`[scraper] モード=${MODE}, 最大件数=${MAX_EVENTS}, 開始ID=${START_ID || '自動'}`);

function ensureDataDir() {
  if (!fs.existsSync(CONFIG.DATA_DIR)) {
    fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
  }
}

function saveJSON(filename, data) {
  ensureDataDir();
  const fp = path.join(CONFIG.DATA_DIR, filename);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[save] ${filename} 保存完了`);
}

function loadJSON(filename, defaultVal) {
  const fp = path.join(CONFIG.DATA_DIR, filename);
  try {
    if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch (e) {
    console.warn(`[load] ${filename} 読み込み失敗: ${e.message}`);
  }
  return defaultVal;
}

function httpsGet(urlStr, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const parsed = new URL(urlStr);
      const options = {
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method:   'GET',
        headers: {
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept':          'application/json, text/html, */*',
          'Accept-Language': 'ja,en;q=0.9',
          'Referer':         CONFIG.BASE_URL + '/',
        },
        timeout: CONFIG.TIMEOUT,
      };
      const req = https.request(options, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          body:   Buffer.concat(chunks).toString('utf-8'),
        }));
      });
      req.on('timeout', () => {
        req.destroy();
        if (n > 0) { setTimeout(() => attempt(n - 1), 2000); }
        else reject(new Error(`Timeout: ${urlStr}`));
      });
      req.on('error', e => {
        if (n > 0) { setTimeout(() => attempt(n - 1), 2000); }
        else reject(e);
      });
      req.end();
    };
    attempt(retries);
  });
}

async function getJSON(endpoint, params = {}) {
  const u = new URL(CONFIG.BASE_URL + endpoint);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  const res = await httpsGet(u.toString());
  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(res.body);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchEventDetail(id) {
  const allResults = [];
  let offset = 0;
  let total  = Infinity;
  let info   = null;

  while (offset < total) {
    const data = await getJSON('/event_result_detail_search', {
      event_holding_id: id, offset, per_page: CONFIG.PER_PAGE,
    });
    if (!data || !data.event) return null;
    if (info === null) { info = data.event; total = data.count || 0; }
    const results = Array.isArray(data.results) ? data.results : [];
    allResults.push(...results);
    offset += CONFIG.PER_PAGE;
    if (results.length < CONFIG.PER_PAGE) break;
    await sleep(CONFIG.REQUEST_DELAY);
  }

  if (!info) return null;
  return {
    id:         String(id),
    title:      info.event_title || '',
    date:       info.event_date?.date || '',
    league:     info.league_name || '',
    regulation: info.regulation || '',
    venue:      info.venue || '',
    prefecture: info.prefecture_name || '',
    capacity:   String(info.capacity || ''),
    url:        `${CONFIG.BASE_URL}/event/detail/${id}/result`,
    entries: allResults.map(r => ({
      rank:        r.rank || 0,
      playerName:  r.player_name || '',
      area:        r.prefecture_name || '',
      deckCode:    r.deck_code || '',
      deckImgUrl:  r.deck_code ? `${CONFIG.DECK_IMG_BASE}${r.deck_code}.png` : '',
      deckPageUrl: r.deck_code ? `${CONFIG.DECK_PAGE_BASE}${r.deck_code}/` : '',
    })),
    fetchedAt: new Date().toISOString(),
  };
}

async function collectIds(startId, maxCount) {
  console.log(`[collect] 開始ID=${startId}, max=${maxCount}`);
  const ids = [];
  let cur = startId;
  let fails = 0;

  while (ids.length < maxCount && fails < CONFIG.MAX_CONSECUTIVE_FAILS) {
    try {
      const data = await getJSON('/event_result_detail_search', {
        event_holding_id: cur, offset: 0, per_page: 1,
      });
      if (data && data.event && data.event.event_title) {
        ids.push(cur);
        fails = 0;
        console.log(`  ✓ ID ${cur}: ${data.event.event_title}`);
      } else {
        fails++;
      }
    } catch (e) {
      fails++;
      if (fails <= 3) console.warn(`  ✗ ID ${cur}: ${e.message}`);
    }
    cur--;
    await sleep(CONFIG.REQUEST_DELAY);
  }
  console.log(`[collect] 完了: ${ids.length}件`);
  return ids;
}

function buildSummary(events) {
  const deckCount = {};
  let totalEntries = 0;
  for (const ev of events) {
    for (const e of (ev.entries || [])) {
      totalEntries++;
      if (e.deckCode) deckCount[e.deckCode] = (deckCount[e.deckCode] || 0) + 1;
    }
  }
  const topDecks = Object.entries(deckCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([deckCode, count]) => ({
      deckCode, count,
      rate: totalEntries > 0 ? Math.round(count / totalEntries * 1000) / 10 : 0,
      deckImgUrl:  `${CONFIG.DECK_IMG_BASE}${deckCode}.png`,
      deckPageUrl: `${CONFIG.DECK_PAGE_BASE}${deckCode}/`,
    }));
  return { generatedAt: new Date().toISOString(), eventCount: events.length, totalEntries, topDecks };
}

function saveSampleData() {
  console.log('[main] サンプルデータを保存します');
  const now = new Date().toISOString();
  const sample = {
    events: [
      {
        id: '952934',
        title: 'シティリーグ2026 シーズン4 オープンリーグ（横浜伊勢佐木町）',
        date: '2026-05-03', league: 'オープン', regulation: 'スタンダード',
        prefecture: '神奈川県', venue: 'トーナメントセンターバトロコ 横浜伊勢佐木町',
        capacity: '64',
        url: 'https://players.pokemon-card.com/event/detail/952934/result',
        entries: [
          { rank:1, playerName:'モト', area:'神奈川県',
            deckCode:'PigQnL-WDTJAj-ggg9nQ',
            deckImgUrl:'https://www.pokemon-card.com/deck/deckView.php/deckID/PigQnL-WDTJAj-ggg9nQ.png',
            deckPageUrl:'https://www.pokemon-card.com/deck/confirm.html/deckID/PigQnL-WDTJAj-ggg9nQ/' },
          { rank:2, playerName:'リリー', area:'埼玉県',
            deckCode:'8cDcDc-n7YAKe-8x8JYx',
            deckImgUrl:'https://www.pokemon-card.com/deck/deckView.php/deckID/8cDcDc-n7YAKe-8x8JYx.png',
            deckPageUrl:'https://www.pokemon-card.com/deck/confirm.html/deckID/8cDcDc-n7YAKe-8x8JYx/' },
          { rank:3, playerName:'マキ', area:'神奈川県',
            deckCode:'Yxcc8G-zQJ1pO-xxYx8x',
            deckImgUrl:'https://www.pokemon-card.com/deck/deckView.php/deckID/Yxcc8G-zQJ1pO-xxYx8x.png',
            deckPageUrl:'https://www.pokemon-card.com/deck/confirm.html/deckID/Yxcc8G-zQJ1pO-xxYx8x/' },
        ],
        fetchedAt: now,
      },
      {
        id: '953201',
        title: 'シティリーグ2026 シーズン4 シニアリーグ（鹿角ラボ）',
        date: '2026-04-29', league: 'シニア', regulation: 'スタンダード',
        prefecture: '秋田県', venue: '道の駅かづの あんとらあ',
        capacity: '32',
        url: 'https://players.pokemon-card.com/event/detail/953201/result',
        entries: [
          { rank:1, playerName:'そうた', area:'東京都', deckCode:'', deckImgUrl:'', deckPageUrl:'' },
          { rank:2, playerName:'a',      area:'新潟県', deckCode:'', deckImgUrl:'', deckPageUrl:'' },
        ],
        fetchedAt: now,
      },
    ],
    updatedAt: now,
    count: 2,
  };
  saveJSON('events.json', sample);
  saveJSON('meta.json', {
    updatedAt: now, checkedAt: now,
    eventCount: sample.events.length, newCount: 0,
    latestEvent: sample.events[0].title, latestId: '952934',
  });
  saveJSON('summary.json', buildSummary(sample.events));
  console.log('[main] サンプルデータ保存完了');
}

async function main() {
  ensureDataDir();
  const existing    = loadJSON('events.json', { events: [], updatedAt: null });
  const existingIds = new Set((existing.events || []).map(e => String(e.id)));
  console.log(`[main] 既存データ: ${existingIds.size}件`);

  if (MODE === 'test') {
    console.log('[main] テストモード');
    saveSampleData();
    return;
  }

  let startId = START_ID;
  if (!startId) {
    if (existing.events && existing.events.length > 0) {
      startId = Math.max(...existing.events.map(e => parseInt(e.id, 10))) + 100;
    } else {
      startId = 970000;
    }
  }

  const newIds    = await collectIds(startId, MAX_EVENTS);
  const targetIds = MODE === 'full' ? newIds : newIds.filter(id => !existingIds.has(String(id)));
  console.log(`[main] 取得対象: ${targetIds.length}件`);

  if (targetIds.length === 0) {
    console.log('[main] 新規イベントなし');
    const now = new Date().toISOString();
    const meta = loadJSON('meta.json', {});
    meta.checkedAt = now;
    meta.newCount  = 0;
    saveJSON('meta.json', meta);

    // events.json がなければサンプルを保存
    if (!fs.existsSync(path.join(CONFIG.DATA_DIR, 'events.json'))) {
      saveSampleData();
    }
    return;
  }

  const newEvents = [];
  for (let i = 0; i < targetIds.length; i++) {
    const id = targetIds[i];
    console.log(`[fetch] [${i+1}/${targetIds.length}] ID=${id}`);
    try {
      const ev = await fetchEventDetail(id);
      if (ev) { newEvents.push(ev); console.log(`  ✓ ${ev.title}`); }
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
    }
    await sleep(CONFIG.REQUEST_DELAY);
  }

  const allEvents = MODE === 'full' ? newEvents : [...newEvents, ...(existing.events || [])];
  const seen = new Set();
  const deduped = allEvents
    .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
    .sort((a, b) => parseInt(b.id, 10) - parseInt(a.id, 10));

  const now = new Date().toISOString();
  saveJSON('events.json', { events: deduped, updatedAt: now, count: deduped.length });
  saveJSON('meta.json', {
    updatedAt: now, checkedAt: now,
    eventCount: deduped.length, newCount: newEvents.length,
    latestEvent: deduped[0]?.title || '', latestId: deduped[0]?.id || '',
  });
  saveJSON('summary.json', buildSummary(deduped));
  console.log(`[main] 完了: 新規${newEvents.length}件, 合計${deduped.length}件`);
}

// エラー時もサンプルデータで続行
main().catch(e => {
  console.error('[main] エラー:', e.message);
  saveSampleData();
  process.exit(0);
});
