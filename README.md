# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  # GymUp Pulse

  ジムの記録、時間、ボリューム、写真をローカル保存しながら見返せるモバイル向けPWAです。

  ## できること

  - セッション開始 / 終了
  - 種目、重量、回数、セット、時間の記録
  - カレンダーで時間 / ボリュームの可視化
  - ジム日に撮った写真の保存
  - 目標値の保存
  - ブラウザのローカル保存による再起動後の復元
  - PWAとしてホーム画面追加、オフライン起動

  ## 開発起動

  ```bash
  npm install
  npm run dev -- --host --port=5173
  ```

  ## ビルド

  ```bash
  npm run build
  ```

  ## モバイルで使う方法

  1. 一度ブラウザでアプリを開く
  2. ブラウザのメニューから「ホーム画面に追加」または「インストール」を選ぶ
  3. 以後はホーム画面のアイコンから起動する

  ## 注意

  - データ保存先はブラウザの `localStorage`
  - 同じ端末 / 同じブラウザごとに別保存
  - PWAでオフライン起動は可能ですが、最初のアクセスには配信元が必要です
  - PCを完全に使わずにスマホ単体で使いたい場合は、静的ホスティングへのデプロイが必要です
      // Enable lint rules for React
