# JavaFX Support — ユーザーガイド

**Tlcsdm JavaFX サポート** へようこそ。本ガイドでは、VS Code 上で JavaFX と FXML の
開発を効率的に行えるよう、拡張機能のすべての機能の使い方を説明します。

> ヒント: コマンドパレット（`Ctrl+Shift+P` / `Cmd+Shift+P`）から
> **JavaFX: ヘルプを表示** を実行すると、いつでも本ガイドを開けます。

## 目次

- [はじめに](#はじめに)
- [FXML シンタックスハイライト](#fxml-シンタックスハイライト)
- [Scene Builder で開く](#scene-builder-で開く)
- [FXML フォーマット](#fxml-フォーマット)
- [リンク編集](#リンク編集)
- [コードナビゲーション](#コードナビゲーション)
- [すべての参照を検索](#すべての参照を検索)
- [ワークスペースシンボル検索](#ワークスペースシンボル検索)
- [FXML ホバー](#fxml-ホバー)
- [FXML 診断](#fxml-診断)
- [FXML クイックフィックス](#fxml-クイックフィックス)
- [JavaFX CSS インテリセンス](#javafx-css-インテリセンス)
- [アウトラインビュー](#アウトラインビュー)
- [設定](#設定)
- [トラブルシューティング](#トラブルシューティング)

## はじめに

1. VS Code マーケットプレイスから **Tlcsdm JavaFX サポート** をインストールします。
2. JavaFX の `.fxml` と `.java` ファイルを含むフォルダーまたはワークスペースを開きます。
3. 任意の `.fxml` ファイルを開くと、自動的に FXML 言語モードに切り替わります。

## FXML シンタックスハイライト

任意の `.fxml` ファイルを開くと自動的に FXML 言語モードになり、タグ・属性・
`fx:*` 名前空間・イベントハンドラー・文字列値に対して完全なシンタックスハイライトが
適用されます。

## Scene Builder で開く

1. VS Code で `.fxml` ファイルを開くか、エクスプローラーで選択します。
2. エディターまたはエクスプローラーで右クリックします。
3. **Scene Builder で開く** を選択します。

Scene Builder が自動的に見つからない場合は、**JavaFX: Scene Builder パスを設定**
コマンド、または `tlcsdm.javafxSupport.sceneBuilderPath` 設定でパスを指定してください。

## FXML フォーマット

1. `.fxml` ファイルを開きます。
2. `Shift+Alt+F`（または設定した「ドキュメントのフォーマット」ショートカット）で
   ドキュメント全体を整形するか、範囲を選択して「選択範囲のフォーマット」を実行します。

## リンク編集

- `<Label>` のような開始タグの名前を変更すると、VS Code が入力に合わせて対応する
  終了タグ `</Label>` を同期します。
- リンク編集は FXML ファイルで既定で有効です。

## コードナビゲーション

**FXML → コントローラー / リソース**

- `fx:controller="com.example.MyController"` を `Ctrl`/`Cmd`+クリックすると
  コントローラークラスを開きます。
- `fx:id="myButton"` を `Ctrl`/`Cmd`+クリックすると `@FXML` フィールドへジャンプします。
- `onAction="#handleClick"` を `Ctrl`/`Cmd`+クリックすると `@FXML` メソッドへジャンプします。
- `@image.png` や `@style.css` などのリソース参照を `Ctrl`/`Cmd`+クリックすると、
  現在の FXML ファイルからの相対パスで参照先ファイルを開きます。
- `styleClass="primary-button"` を `Ctrl`/`Cmd`+クリックすると、ワークスペースの
  CSS ファイル内の一致する `.primary-button` セレクターへジャンプします。

**コントローラー → FXML**

- `@FXML` フィールドを `Ctrl`/`Cmd`+クリックすると FXML の `fx:id` へジャンプします。
- `@FXML` メソッドを `Ctrl`/`Cmd`+クリックすると FXML のイベントハンドラーへジャンプします。

**CSS → FXML**

- `.primary-button` のような CSS セレクターで `Shift+F12` を押すと、ワークスペースの
  FXML ファイル内で一致する `styleClass` の使用箇所を一覧表示します。

## すべての参照を検索

- FXML の `fx:id="myButton"` で `Shift+F12` を押すと、現在の FXML ファイル内の
  `$myButton` の使用箇所と、一致するコントローラーフィールドの宣言を検索します。

## ワークスペースシンボル検索

- `Ctrl+T`（Windows/Linux）または `Cmd+T`（macOS）を押します。
- FXML の `fx:id` 値または一致する Java の `@FXML` フィールド名を検索すると、
  ワークスペースのどこからでもジャンプできます。

## FXML ホバー

- `fx:controller`、`fx:id`、イベントハンドラーにホバーすると、一致するコントローラー
  クラス・フィールド・メソッドのコメント（継承されたメンバーを含む）を表示します。
- ホバーは**既定で無効**です。`tlcsdm.javafxSupport.hover.enabled` で有効化し、
  `tlcsdm.javafxSupport.hover.delay` で遅延を調整できます。

## FXML 診断

問題は **問題** パネルに報告されます。

- 見つからない `fx:controller` クラスはエラーとして報告されます。
- 一致するコントローラーフィールドがない `fx:id` 値は警告として報告されます。
- `#handleClick` のような見つからないコントローラーのイベントハンドラーはエラーです。
- 同じ FXML ファイル内の重複する `fx:id` 値はエラーとして報告されます。

## FXML クイックフィックス

- 見つからない `fx:id` の警告で `Ctrl+.` / `Cmd+.` を使うと、コントローラーに
  `@FXML private <Type> <fxId>;` を生成します。
- 見つからない `onAction` ハンドラーのエラーで `Ctrl+.` / `Cmd+.` を使うと、
  コントローラーに `@FXML private void <handler>(ActionEvent event) {}` を生成します。

## JavaFX CSS インテリセンス

- `.css` ファイルまたは FXML の `style` 属性で `-fx-` と入力すると、
  `-fx-background-color`、`-fx-font-size`、`-fx-text-fill` などの JavaFX 固有の
  CSS プロパティが表示されます。
- FXML の `styleClass=""` 属性内で入力すると、ワークスペースの `.css` ファイルから
  検出した CSS クラス名を補完します。
- `-fx-alignment:` などのプロパティの後には、`CENTER` や `TOP_LEFT` などの一般的な
  列挙値が候補として表示されます。
- JavaFX CSS プロパティにホバーすると、構文・既定値・適用対象が表示されます。

## アウトラインビュー

**アウトライン** ビューを開くと FXML 要素ツリーを確認できます。
`tlcsdm.javafxSupport.outline.showFxId` と `tlcsdm.javafxSupport.outline.showText`
の設定で、各ノードに `fx:id` と `text` の詳細を表示するかを制御します。

## 設定

| 設定 | 説明 | 既定値 |
|------|------|--------|
| `tlcsdm.javafxSupport.sceneBuilderPath` | Scene Builder 実行ファイルのパス | `""`（自動検出） |
| `tlcsdm.javafxSupport.hover.enabled` | FXML ホバー情報を有効にする | `false` |
| `tlcsdm.javafxSupport.hover.delay` | FXML ホバー情報を表示するまでの遅延（ミリ秒） | `300` |
| `tlcsdm.javafxSupport.outline.showFxId` | FXML アウトラインビューに `fx:id` 詳細を表示 | `true` |
| `tlcsdm.javafxSupport.outline.showText` | FXML アウトラインビューに `text` 詳細を表示 | `true` |

## トラブルシューティング

- **`.fxml` ファイルが XML として開かれる** —— 拡張機能が自動的に言語を FXML に
  修正します。修正されない場合は「言語モードの変更」を実行して **FXML** を選択します。
- **Scene Builder が開かない** —— `tlcsdm.javafxSupport.sceneBuilderPath` に Scene
  Builder 実行ファイルのフルパスを設定するか、**JavaFX: Scene Builder パスを設定**
  を実行してください。
- **ナビゲーションが解決しない** —— インデックスできるよう、コントローラーの
  `.java` ファイルが開いているワークスペース内にあることを確認してください。

問題の報告や機能リクエストは
[プロジェクトリポジトリ](https://github.com/tlcsdm/vscode-javafx-support/issues)
をご覧ください。
