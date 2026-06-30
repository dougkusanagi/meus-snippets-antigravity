# CHANGELOG

Este projeto segue SemVer e mantem um changelog unico em ordem da release mais recente para a mais antiga.

## [v0.1.1] - 2026-06-30

### Added

- Workflow dedicado de release no GitHub Actions para gerar e anexar os binarios Windows diretamente nas tags `v*`.
- Expansao automatica inline no Windows para snippets cujo gatilho comeca com `/`, substituindo o texto enquanto o usuario digita fora do proprio app.

### Changed

- Pipeline de CI reorganizada para manter Windows ativo e preservar os jobs de Linux e macOS no repositório, mas desativados de forma compativel com o GitHub Actions.
- Roadmap e documentacao atualizados para refletir que a primeira etapa da expansao automatica agora existe no Windows, mantendo picker como fallback para snippets com variaveis preenchiveis.

### Fixed

- Publicacao de releases ajustada para evitar tags sem assets `.msi` e `.exe` no GitHub Releases.
- Verificacao de atualizacao agora explica corretamente quando a API publica do GitHub nao consegue acessar releases de um repositorio privado, em vez de exibir apenas uma falha generica.

## [v0.1.0] - 2026-06-30

### Added

- Regras explicitas de versionamento semantico `MAJOR.MINOR.PATCH` documentadas para manutencao do projeto.
- Instrucoes operacionais no `AGENTS.md` exigindo atualizacao do `CHANGELOG.md` em toda mudanca relevante.
- Importacao direta de snippets do TextExpander via CSV exportado, com criacao automatica de categoria por arquivo importado.

### Changed

- Padronizacao do fluxo de release para exigir alinhamento de versao entre `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`.
- Clarificacao dos criterios para uso de `Added`, `Changed` e `Fixed` no changelog.
- Fluxo de importacao ajustado para deixar explicito quando a operacao vai apagar a biblioteca atual antes de substituir os snippets.
- Controle de ordenacao dos snippets movido para um menu dropdown de icone ao lado da busca, liberando espaco na barra lateral e mantendo as opcoes visiveis apenas ao abrir o menu.
- Barra de `Pasta atual` estabilizada com botao de voltar fixo em formato de icone, evitando que o titulo deslize ao entrar ou sair da raiz.
- Navegacao lateral refinada com icone de raiz mais claro na pasta inicial e cards de categoria totalmente clicaveis na sidebar.
- Workflow do GitHub Actions mantido com definicoes para Windows, Linux e macOS, mas com os jobs de Linux e macOS desativados no servidor.

### Fixed

- Removida a ambiguidade sobre quando registrar novidades, correcoes e ajustes de versao no historico do projeto.
- Importacao de CSVs do TextExpander sem cabecalho na primeira linha e conversao de tokens como `%key:enter%` para a estrutura interna de macros do app.
- Removido o botao `Manual` da area de pasta atual, que passava a impressao de acao sem efeito ao navegar pela lista.

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
