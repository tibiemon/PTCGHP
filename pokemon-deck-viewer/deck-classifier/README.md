# デッキ自動判定ロジック — deckClassifier.js

## 概要

ポケモンカードゲーム公式サイト（プレイヤーズクラブ）のデッキページから取得した  
カード構成データをもとに、**デッキ名を自動判定**するJavaScriptモジュールです。

---

## ファイル構成

```
deck-classifier/
├── deckClassifier.js       # メインロジック（Node.js / ブラウザ両対応）
├── deckClassifier.test.js  # ユニットテスト（Node.js）
├── demo.html               # ブラウザ動作確認デモ
└── README.md               # このファイル
```

---

## データソース（公式サイトの構造）

公式デッキ表示ページ `www.pokemon-card.com/deck/confirm.html/deckID=XXXX` には  
2種類の形式でカードデータが埋め込まれています。

### 1. hidden input フィールド

```html
<input type="hidden" id="deck_pke"  value="48397_3_1-48396_4_1-...">
<input type="hidden" id="deck_gds"  value="45209_3_1-...">
<input type="hidden" id="deck_tool" value="41126_2_1">
<input type="hidden" id="deck_sup"  value="48253_3_1-...">
<input type="hidden" id="deck_sta"  value="47796_2_1">
<input type="hidden" id="deck_ene"  value="47909_9_1">
```

フォーマット: `カードID_枚数_メインフラグ` をハイフン区切り

| フィールドID | カテゴリ |
|---|---|
| `deck_pke`  | ポケモン |
| `deck_gds`  | グッズ |
| `deck_tool` | ポケモンのどうぐ |
| `deck_sup`  | サポート |
| `deck_sta`  | スタジアム |
| `deck_ene`  | エネルギー |

### 2. window.PCGDECK オブジェクト

```js
window.PCGDECK = {
  searchItemCardName: { "48397": "ストリンダー", "48396": "エレズン", ... },
  searchItemCardPict: { "48397": "/assets/images/card/...", ... },
  deck_pke: "48397_3_1-48396_4_1-...",
  // ...
};
```

カードID → カード名・画像パスのマッピングが含まれます。

---

## 入力データ形式

```js
const cards = [
  { id: "48397", name: "ストリンダー",     count: 3, category: "pokemon" },
  { id: "48396", name: "エレズン",         count: 4, category: "pokemon" },
  { id: "47909", name: "基本悪エネルギー", count: 9, category: "energy" },
  // ...
];
```

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | カードID（5桁数字） |
| `name` | string | カード名 |
| `count` | number | デッキ内の枚数 |
| `category` | string | `pokemon` / `goods` / `tool` / `supporter` / `stadium` / `energy` |

---

## 出力データ形式

```js
{
  name: "リザードン ex",          // 判定されたデッキ名
  confidence: "high",             // 信頼度: "high" | "medium" | "low"
  tags: ["炎", "ex", "2進化"],   // タグ一覧
  reason: "リザードン ex として判定",  // 判定理由
  candidates: [                   // 上位候補（スコア順）
    { name: "リザードン ex", score: 9 },
    { name: "ピジョット ex", score: 3 },
  ]
}
```

---

## 使い方

### ブラウザ

```html
<script src="deckClassifier.js"></script>
<script>
  const result = DeckClassifier.classifyDeck(cards);
  console.log(result.name);        // "リザードン ex"
  console.log(result.confidence);  // "high"
</script>
```

### Node.js

```js
const { classifyDeck, aggregateUsageRates } = require('./deckClassifier');

const result = classifyDeck(cards);
console.log(result.name);
```

### 公式ページHTMLからカードを抽出

```js
const { parseOfficialDeckPage, classifyDeck } = require('./deckClassifier');

// fetch等でHTMLを取得した後
const cards = parseOfficialDeckPage(html);
const result = classifyDeck(cards);
```

### window.PCGDECK から直接パース（ブラウザ内）

```js
// 公式デッキページ内で実行
const cards = DeckClassifier.parsePCGDECK(window.PCGDECK);
const result = DeckClassifier.classifyDeck(cards);
```

---

## 使用率集計

```js
const { aggregateUsageRates } = require('./deckClassifier');

const deckEntries = [
  { cards: deck1Cards, playerName: "プレイヤーA", rank: 1 },
  { cards: deck2Cards, playerName: "プレイヤーB", rank: 2 },
  // ...
];

const { summary, total, unclassified } = aggregateUsageRates(deckEntries);

// summary[0] = { name: "リザードン ex", count: 3, rate: 37.5, tags: [...], players: [...] }
```

---

## 判定ロジック設計

### 判定フロー

```
入力カードリスト
    │
    ▼
ポケモンカードのみ抽出
    │
    ▼
全ルールを評価（優先度順）
    ├─ required: 全て含まれるか
    ├─ any: いずれか1枚以上含まれるか
    ├─ forbidden: 含まれていないか
    ├─ minCount: 合計枚数が閾値以上か
    └─ custom: カスタム関数が true を返すか
    │
    ▼
マッチしたルールをスコア順にソート
    │
    ├─ マッチあり → デッキ名・信頼度・タグを返す
    └─ マッチなし → 未分類処理
                        │
                        ▼
                   主力ポケモンを推定
                   （ex/VSTAR/VMAX/V/GX 優先）
                        │
                        ▼
                   エネルギータイプからタグ付与
                        │
                        ▼
                   confidence=low で返す
```

### 信頼度の決定基準

| 条件 | 信頼度 |
|---|---|
| マッチが1件のみ、またはスコアが2位の1.5倍以上 | `high` |
| マッチが2〜3件 | `medium` |
| マッチが4件以上 | `low` |
| ルール未定義 | `low` |

### ルール優先度（priority）

| 優先度 | 用途 |
|---|---|
| 105 | 複合デッキ（ロストギラティナ等）・メガ進化 |
| 100 | 主要デッキ（リザードン ex 等） |
| 95 | サブアタッカー軸（ピジョット ex 等） |
| 90 | 単体型・バリエーション |
| 80 | 展開サポート軸（ビーダル等） |

---

## ルール追加方法

`DECK_RULES` 配列に以下の形式でオブジェクトを追加します。

```js
{
  name: 'デッキ名',
  priority: 100,
  tags: ['タイプ', 'ex', 'アタッカー'],
  conditions: {
    required: ['必須カード名1', '必須カード名2'],  // 全て含まれる必要あり
    any: ['いずれか1', 'いずれか2'],               // 1枚以上含まれる必要あり
    forbidden: ['含んではいけないカード名'],        // 含まれると失敗
    minCount: 3,                                    // required の合計枚数の下限
    custom: (cards) => {                            // カスタム判定
      return cards.some(c => c.name === '特定カード');
    },
  },
}
```

**カード名マッチングは部分一致**です。  
`'リザードン ex'` というパターンは `'リザードン ex（特別なイラスト）'` にもマッチします。

---

## テスト実行

```bash
node deckClassifier.test.js
```

全23件のテストケースが含まれています。

---

## 未分類デッキの扱い

ルールにマッチしなかったデッキは以下の処理を行います。

1. **主力ポケモンの推定**  
   `ex` / `VSTAR` / `VMAX` / `V` / `GX` サフィックスを持つポケモンを優先し、  
   最多枚数のものを主力と判断します。

2. **デッキ名の生成**  
   `{主力ポケモン名}（未分類）` という形式で返します。

3. **エネルギータイプからタグ付与**  
   エネルギーカード名から炎・水・雷などのタイプタグを自動付与します。

4. **戦略タグの付与**  
   エネルギー合計枚数が3枚以下の場合は `コントロール`、それ以外は `アタッカー` タグを付与します。

5. **信頼度は常に `low`**  
   未分類デッキは必ず `confidence: 'low'` で返します。

---

## 注意事項

- カード名マッチングは**部分一致**のため、類似名カードに誤マッチする可能性があります。  
  精度向上にはカードIDによる完全一致マッチングを推奨します。
- 環境変化（新弾発売・レギュレーション変更）に合わせて `DECK_RULES` の更新が必要です。
- 公式サイトのHTML構造変更により `parseOfficialDeckPage` が動作しなくなる場合があります。