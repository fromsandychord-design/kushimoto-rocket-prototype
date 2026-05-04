# CLAUDE.md — kushimoto-rocket-prototype

## シークレット運用（Phase 2: 1Password CLI + direnv）

シークレット管理は **`~/.claude/CLAUDE.md` の「シークレット運用ルール（Phase 2）」セクション** に従う。
vault: `morethansix-secrets` / 注入機構: `op inject` + direnv / `.env.local` 直書き禁止。
矛盾があればグローバル CLAUDE.md が優先。

## セキュリティルール（全実装で必ず守ること）

> 背景: 2026-04-15 全プロジェクト横断セキュリティ監査で検出された問題の再発防止。

### シークレット管理
- コードにAPIキー/パスワードを直書きしない
- .envファイルは.gitignoreに含める
- 静的HTMLに秘密情報を埋め込まない

### CDN / 外部リソース
- 外部CDNから読み込むスクリプト/CSSにはSRI（Subresource Integrity）ハッシュを付与
- 信頼できるCDNのみ使用（cdnjs, unpkg, jsdelivr）

### セルフチェックリスト
実装完了時に以下を確認:
- □ シークレットがハードコードされていないか
- □ 外部スクリプトにSRIが付与されているか
- □ デバッグコードが残っていないか
