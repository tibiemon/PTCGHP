# ポケカ大会デッキ一覧 — GitHub Actions + GitHub Pages 構成

## 概要

**コスト0円・サーバーレス**でポケカ大会デッキデータを自動取得・公開する仕組みです。

```
GitHub Actions（無料枠）
    ↓ 毎時自動実行
プレイヤーズクラブ API をスクレイピング
    ↓
data/events.json をリポジトリに自動コミット
    ↓
GitHub Pages（無料）で静的サイトとして公開
```

---

## アーキテクチャ

```
your-repo/
├── .github/
│   └── workflows/
│       ├── scrape.yml          ← 定期スクレイピング（毎時）
│       └── deploy-pages.yml    ← Pages デプロイ（data変更時）
├── scripts/
│   ├── scraper.js              ← スクレイパー本体
│   ├── validate.js             ← データ検証
│   ├── build-pages.js          ← 静的サイト生成
│   └── package.json
├── data/                       ← 自動生成（コミットされる）
│   ├── events.json             ← 大会データ
│   ├── meta.json               ← メタ情報
│   └── summary.json            ← 使用率サマリー
├── docs/                       ← GitHub Pages 公開ディレクトリ（自動生成）
└── pokemon-deck-viewer/        ← フロントエンド（前回作成分）
```

---

## セットアップ手順

### 1. リポジトリを作成

```bash
# 新規リポジトリを作成（GitHub上でも可）
git init pokemon-deck-site
cd pokemon-deck-site

# このファイル群をコピー
cp -r pokemon-deck-actions/. .
cp -r pokemon-deck-viewer ./pokemon-deck-viewer

git add .
git commit -m "初期コミット"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. GitHub Pages を有効化

1. リポジトリの **Settings** → **Pages**
2. **Source** を `Deploy from a branch` に設定
3. **Branch** を `gh-pages` / `/ (root)` に設定
4. **Save** をクリック

または `peaceiris/actions-gh-pages` が自動で `gh-pages` ブランチを作成します。

### 3. Actions の権限設定

1. リポジトリの **Settings** → **Actions** → **General**
2. **Workflow permissions** を `Read and write permissions` に設定
3. **Save** をクリック

### 4. 初回手動実行

1. **Actions** タブ → `ポケカデッキデータ自動取得`
2. **Run workflow** → `mode: diff`, `max_events: 30` → **Run workflow**
3. 実行完了後、`data/events.json` がコミットされることを確認

---

## ワークフロー詳細

### scrape.yml（メインワークフロー）

| トリガー | 処理 | 取得件数 |
|---|---|---|
| 毎時30分（cron） | 差分更新 | 最大20件 |
| 毎日18時UTC（cron） | 全件更新 | 最大100件 |
| 手動実行 | 選択可能 | 指定可能 |
| mainへのpush | 差分更新 | 最大5件 |

### deploy-pages.yml（デプロイワークフロー）

`data/` または `pokemon-deck-viewer/` に変更があった場合に自動デプロイ。

---

## GitHub Actions 無料枠

| プラン | 月間無料分 |
|---|---|
| **Public リポジトリ** | **無制限** ✅ |
| Private（Free） | 2,000分/月 |

**Public リポジトリなら完全無料**です。

1回の実行時間の目安：
- 差分更新（20件）: 約3〜5分
- 全件更新（100件）: 約15〜20分
- 毎時実行（24回/日）: 約72〜120分/日

---

## データ取得の仕組み

### APIエンドポイント（認証不要）

```
GET https://players.pokemon-card.com/event_result_detail_search
  ?event_holding_id={イベントID}
  &offset={オフセット}
  &per_page=32
```

**レスポンス例:**
```json
{
  "count": 64,
  "event": {
    "event_title": "シティリーグ2026 シーズン4 オープンリーグ",
    "event_date": { "date": "2026-05-03" },
    "league_name": "オープン",
    "regulation": "スタンダード",
    "prefecture_name": "神奈川県",
    "venue": "トーナメントセンターバトロコ 横浜伊勢佐木町",
    "capacity": 64
  },
  "results": [
    {
      "rank": 1,
      "player_name": "モト",
      "prefecture_name": "神奈川県",
      "deck_code": "PigQnL-WDTJAj-ggg9nQ",
      "point": 100
    }
  ]
}
```

### デッキ画像URL

```
https://www.pokemon-card.com/deck/deckView.php/deckID/{デッキコード}.png
```

### ID探索アルゴリズム

```
既存の最大ID + 100 から降順に探索
  → APIが200を返す = 有効なイベント
  → 15回連続で失敗 = 探索終了
```

---

## 生成されるファイル

### data/events.json

```json
{
  "events": [
    {
      "id": "952934",
      "title": "シティリーグ2026 シーズン4 オープンリーグ",
      "date": "2026-05-03",
      "league": "オープン",
      "regulation": "スタンダード",
      "prefecture": "神奈川県",
      "venue": "トーナメントセンターバトロコ 横浜伊勢佐木町",
      "capacity": "64",
      "url": "https://players.pokemon-card.com/event/detail/952934/result",
      "entries": [
        {
          "rank": 1,
          "playerName": "モト",
          "area": "神奈川県",
          "deckCode": "PigQnL-WDTJAj-ggg9nQ",
          "deckImgUrl": "https://www.pokemon-card.com/deck/deckView.php/deckID/PigQnL-WDTJAj-ggg9nQ.png",
          "deckPageUrl": "https://www.pokemon-card.com/deck/confirm.html/deckID/PigQnL-WDTJAj-ggg9nQ/"
        }
      ],
      "fetchedAt": "2026-05-31T00:00:00.000Z"
    }
  ],
  "updatedAt": "2026-05-31T00:00:00.000Z",
  "count": 445
}
```

### docs/api/events.json（GitHub Pages経由でアクセス可能）

```
https://YOUR_USERNAME.github.io/YOUR_REPO/api/events.json
https://YOUR_USERNAME.github.io/YOUR_REPO/api/meta.json
https://YOUR_USERNAME.github.io/YOUR_REPO/api/summary.json
https://YOUR_USERNAME.github.io/YOUR_REPO/api/events/{id}.json
```

---

## フロントエンドとの連携

`pokemon-deck-viewer/app.js` の `loadData()` を以下に変更：

```javascript
async function loadData() {
  // GitHub Pages の静的JSONを直接フェッチ（CORS不要）
  const res = await fetch(
    'https://YOUR_USERNAME.github.io/YOUR_REPO/api/events.json'
  );
  const data = await res.json();

  STATE.allEvents   = data.events || [];
  STATE.filtered    = data.events || [];
  STATE.lastUpdated = data.updatedAt ? new Date(data.updatedAt) : null;
  STATE.currentPage = 1;

  hideLoading();
  renderEventList();
}
```

**同一リポジトリの場合（相対パス）:**
```javascript
const res = await fetch('./api/events.json');
```

---

## カスタマイズ

### 取得頻度を変更

`.github/workflows/scrape.yml` の `cron` を編集：

```yaml
schedule:
  # 30分ごとに実行
  - cron: '*/30 * * * *'
  # 毎日1回（日本時間9時 = UTC 0時）
  - cron: '0 0 * * *'
```

### 取得件数を変更

```yaml
- name: スクレイピング実行
  run: |
    node scraper.js --mode="$MODE" --max-events=50
```

### 特定の大会種別のみ取得

`scripts/scraper.js` の `fetchEventDetail` 内でフィルタリング：

```javascript
// シティリーグとCLのみ保存
if (!ev.title.includes('シティリーグ') && !ev.title.includes('チャンピオンズリーグ')) {
  return null;
}
```

---

## トラブルシューティング

### Actions が失敗する場合

1. **権限エラー**: Settings → Actions → General → `Read and write permissions` を確認
2. **レート制限**: `REQUEST_DELAY` を 2000ms 以上に増やす
3. **IDが見つからない**: `--start-id` を手動で指定して実行

### データが更新されない場合

1. Actions タブでワークフローのログを確認
2. `data/events.json` の `updatedAt` を確認
3. 手動で `workflow_dispatch` から実行

### GitHub Pages が表示されない場合

1. Settings → Pages → Source が `gh-pages` ブランチになっているか確認
2. `gh-pages` ブランチが存在するか確認（初回デプロイ後に作成される）
3. `docs/.nojekyll` ファイルが存在するか確認