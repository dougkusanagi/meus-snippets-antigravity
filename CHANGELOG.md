# CHANGELOG

Este projeto segue SemVer e mantem um changelog unico em ordem da release mais recente para a mais antiga.

## [v0.1.0] - 2026-06-30

### Added

- Regras explicitas de versionamento semantico `MAJOR.MINOR.PATCH` documentadas para manutencao do projeto.
- Instrucoes operacionais no `AGENTS.md` exigindo atualizacao do `CHANGELOG.md` em toda mudanca relevante.
- Importacao direta de snippets do TextExpander via CSV exportado, com criacao automatica de categoria por arquivo importado.

### Changed

- Padronizacao do fluxo de release para exigir alinhamento de versao entre `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`.
- Clarificacao dos criterios para uso de `Added`, `Changed` e `Fixed` no changelog.
- Fluxo de importacao ajustado para deixar explicito quando a operacao vai apagar a biblioteca atual antes de substituir os snippets.

### Fixed

- Removida a ambiguidade sobre quando registrar novidades, correcoes e ajustes de versao no historico do projeto.
- Importacao de CSVs do TextExpander sem cabecalho na primeira linha e conversao de tokens como `%key:enter%` para a estrutura interna de macros do app.

## [v0.0.1] - 2026-06-12

### Added

- Gerenciador desktop picker-first para snippets e macros com busca por gatilho, nome, categoria e tags.
- Onboarding inicial, configuracao de atalho global e fluxo de ajuda para permissoes em Linux Wayland e macOS.
- Importacao e exportacao de snippets em JSON, preview de macros e duplicacao de snippets.
- Verificacao de atualizacao via GitHub Releases com botao para baixar a release mais recente.

### Changed

- Padronizacao do processo de release em GitHub e documentacao de versionamento do projeto.

### Fixed

- Ajustes de UX e infraestrutura para empacotamento e publicacao da primeira release.
