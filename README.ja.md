# FileHub Server

Node.js と React で構築されたクロスプラットフォームのファイル検索・プレビューサーバーです。Web ベースの UI でファイルの即時検索・プレビュー・アクセスが可能で、ローカルネットワーク上の任意のブラウザから利用できます。

## 機能

- **即時検索** — 文字列・あいまい・正規表現の 3 つの検索モード、サブ秒レスポンス
- **ファイルプレビュー** — PDF・画像・動画・音声・Office ドキュメント（xlsx/docx）・Markdown・シンタックスハイライト付きコード
- **LAN アクセス** — 同一ネットワーク上の他デバイスとファイルインデックスを共有
- **QR コード** — スキャンするだけでモバイルから即アクセス
- **柔軟な設定** — インデックス対象ディレクトリと除外パターンをカスタマイズ
- **ダーク/ライトテーマ**
- **REST API** — すべての機能を HTTP API 経由で利用可能

## 動作環境

- Node.js 18+
- npm 9+

## インストール

### 方法一：Docker（推奨）

```bash
# 最新バージョンをプルして実行
docker pull exiahuang/filehub-server:latest
docker run -d -p 6543:6543 -v /あなたのデータ:/data exiahuang/filehub-server:latest
```

ブラウザで `http://localhost:6543` を開きます。

### 方法二：ソースからインストール

```bash
git clone https://github.com/filehub1/filehub-server.git
cd filehub/server
npm install
npm run build
```

## 起動

```bash
# サーバー起動（デフォルトポート 6543）
npm start

# 開発モード（ホットリロード）
npm run dev

# Web のみモード（Electron 不要）
npm run dev:web
```

## 設定

`~/.filehub` を作成（YAML 形式）：

```yaml
indexedDirectories:
  - /home/user/Documents
  - /home/user/Projects
serviceAddress: 0.0.0.0:6543
excludePatterns:
  - node_modules
  - .git
  - dist
  - "*.log"
```

### 設定項目

| キー | 型 | デフォルト | 説明 |
|------|----|-----------|------|
| `indexedDirectories` | `string[]` | `[]` | インデックス対象ディレクトリ |
| `serviceAddress` | `string` | `0.0.0.0:6543` | サーバーのリッスンアドレス |
| `uiAddress` | `string` | `0.0.0.0:6544` | 開発 UI サーバーアドレス |
| `excludePatterns` | `string[]` | `[]` | スキップするファイル/ディレクトリパターン |
| `useAdminMode` | `boolean` | `false` | 管理者モードを有効化 |

### コマンドライン引数による上書き

```bash
node dist/main/web-server.cjs --dir=/home/user/Documents
node dist/main/web-server.cjs --service-address=0.0.0.0:8080
```

## 使い方

1. ブラウザで `http://localhost:6543` を開く
2. `/` キーで検索ボックスにフォーカス
3. キーワードを入力すると即座に結果が表示される
4. `Enter` または `l` でファイルを開く
5. `o` でプレビューパネルを切り替え
6. `\` で検索モードを切り替え（文字列 / あいまい / 正規表現）

### キーボードショートカット

| キー | 操作 |
|------|------|
| `/` | 検索ボックスにフォーカス |
| `j` / `↓` | 下に移動 |
| `k` / `↑` | 上に移動 |
| `Enter` / `l` | ファイルを開く |
| `o` | プレビュー切り替え |
| `O` | エクスプローラーで開く |
| `\` | 検索タイプ切り替え |
| `r` | インデックス再構築 |
| `s` | 設定 |
| `?` | ヘルプ |

## API

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/search?query=&searchType=string` | GET | ファイル検索 |
| `/api/config` | GET | 現在の設定を取得 |
| `/api/config` | POST | 設定を更新 |
| `/api/rebuild` | POST | インデックス再構築 |
| `/api/preview?path=` | GET | ファイルプレビュー取得 |
| `/api/status` | GET | インデックス状態 |

## ネイティブアドオンのビルド（Windows のみ）

Windows MFT/USN Journal による高速インデックスを利用する場合：

```bash
cd src/addon
node-gyp configure
node-gyp build
```

## ライセンス

MIT
