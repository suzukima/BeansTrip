# BeansTrip

買ったコーヒー豆が、世界のどこから来たかを地図に記録・可視化するWebアプリケーションです。

## 主な機能
* **コーヒー豆の記録**: 銘柄、生産国、購入店、焙煎度、精製方法、味のメモ、パッケージ写真、デカフェ、お気に入りなどを登録。
* **地図の可視化**: 記録した豆の生産国を世界地図（GeoJSON）上に色付け。購入数に応じたグラデーション表示やタップによるズームに対応。
* **履歴の絞り込み**: 生産国、焙煎度、購入店、デカフェ、お気に入りの各条件でフィルタリング。
* **画像の軽量保存**: パッケージ画像をブラウザ側でリサイズし、Base64文字列として直接データベースに保存（Storage不要）。

## 技術スタック
* **Frontend**: React (Vite), D3.js, Lucide React
* **Backend**: Firebase (Authentication, Firestore)
* **Hosting**: GitHub Pages

## ローカル環境での起動手順

### 1. パッケージのインストール
```bash
npm install
```

### 2. Firebase設定ファイルの作成
`src` フォルダ直下に `firebase.js` を作成し、Firebaseコンソールから取得した構成オブジェクトを記述してください。

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

### 3. 開発サーバーの起動
```bash
npm run dev
```
ブラウザで `http://localhost:5173/` にアクセスします。

## デプロイとセキュリティ設定
本アプリはGitHub Pagesにデプロイして稼働します。

```bash
# デプロイコマンド
npm run deploy
```

**【注意事項】**
利用者を制限するため、Firestoreのセキュリティルールにて、特定のUIDを持つユーザー（管理者）のみが読み書きできるように設定しています。

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /beans/{document} {
      allow read, write: if request.auth != null && request.auth.uid == '管理者のUID';
    }
  }
}
```
また、GCPコンソール側でAPIキーにHTTPリファラーの制限（GitHub PagesのURLとローカルホスト）を追加しています。