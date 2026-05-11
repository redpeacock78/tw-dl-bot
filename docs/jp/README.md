> English: [../README.md](../README.md)

# tw-dl-bot ドキュメント

このディレクトリには、**tw-dl-bot** の開発者向けドキュメントが含まれています。tw-dl-botはDeno + TypeScript製のDiscord Botで、GitHub Actions上のyt-dlpを使用してツイートから動画をダウンロードします。

## 内容

- [Architecture（アーキテクチャ）](./architecture.md) — 高レベルなシステム概要。Discord、Bot、GitHub Actions（`run.yml` + `run-thread.yml`）、yt-dlp間のデータフロー。
- [Commands（コマンド）](./commands.md) — `/dl`、`/dl-spoiler`、`/threaddl` スラッシュコマンドのリファレンス。
- [Development（開発）](./development.md) — ローカル開発環境のセットアップ、環境変数、GitHubトークンスコープ、Denoテストスイート。
- [Deployment（デプロイ）](./deployment.md) — デプロイメント流れ、Runnerイメージのビルド・公開、ランタイム環境。
- [GitHub Actions](./github-actions.md) — `repository_dispatch` ペイロードスキーマ（`download` 型と `thread-download` 型）の解説。callback API、status routing（thread mode含む）、必要なsecretsもまとめています。

## 関連リンク

- トップレベル [README](../../README.md) — プロジェクト概要、セットアップ、コマンド一覧。
- [LICENSE](../../LICENSE) — MIT。
