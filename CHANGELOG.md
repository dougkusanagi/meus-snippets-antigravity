# CHANGELOG

Este projeto segue SemVer e mantem um changelog unico em ordem da release mais recente para a mais antiga.

## [Unreleased]

### Fixed

- Expansao inline no Windows voltou a aceitar campos com foco inconclusivo ou expostos apenas com `ValuePattern`, bloqueando apenas controles explicitamente nao textuais ao avaliar gatilhos com `/`.

## [v0.1.2] - 2026-07-01

### Added

- Expansao inline no Windows agora valida o contexto de foco antes de aceitar gatilhos com `/`, permitindo apenas controles claramente textuais.

### Changed

- Fluxo de build local passou a carregar automaticamente a chave de assinatura do updater de `keys/updater.key` ao executar `bun run tauri build`.
- Chave de assinatura do updater rotacionada para gerar novas builds locais com artefatos assinados.

### Fixed

- Expansao inline no Windows deixou de disparar em controles numericos e nao-textuais como Calculadora, sliders, spinners e outros contextos sem evidencia confiavel de texto livre.

## [v0.1.1] - 2026-06-30

### Added

- Workflow dedicado de release no GitHub Actions para gerar e anexar os binarios Windows diretamente nas tags `v*`.
- Expansao automatica inline no Windows para snippets cujo gatilho comeca com `/`, substituindo o texto enquanto o usuario digita fora do proprio app.
- Novo formulario completo para criar e editar categorias com nome, icone e pasta pai no mesmo fluxo.
- Novo picker leve de categorias para escolher rapidamente a pasta de um snippet sem expor acoes administrativas.

### Changed

- Biblioteca do manager foi unificada na sidebar com accordion multi-expansivel, permitindo navegar por categorias e abrir snippets no mesmo painel lateral.
- Pipeline de CI reorganizada para manter Windows ativo e preservar os jobs de Linux e macOS no repositório, mas desativados de forma compativel com o GitHub Actions.
- Roadmap e documentacao atualizados para refletir que a primeira etapa da expansao automatica agora existe no Windows, mantendo picker como fallback para snippets com variaveis preenchiveis.
- Manager reorganizado com sidebar focada em exploracao de pastas, lista de snippets no painel principal e editor separado para escalar melhor com bibliotecas maiores.
- Contrato do campo de gatilho padronizado para persistir apenas o identificador sem `/`, mantendo a expansao por `/gatilho` apenas como formato de uso e exibicao.
- Busca e listagens do manager e do picker passaram a apresentar os gatilhos com prefixo visual `/` sem alterar o valor salvo.
- Gerenciamento de categorias refeito do zero com modal split-view, arvore rolavel e painel lateral de edicao, substituindo a navegacao quebrada por niveis.
- Selecao de categoria no editor de snippet agora usa um campo clicavel e remove o botao textual `Escolher pela arvore`.

### Fixed

- Sidebar do manager agora mantém scroll interno com altura limitada à janela principal, evitando quebrar o layout quando existem muitas categorias ou snippets.
- Gatilhos iniciados por `/` no Windows agora reiniciam o rastreamento no momento da digitacao, em vez de depender de um estado interno de “inicio de palavra” que ficava incorreto apos selecoes, delecoes ou reposicionamento do cursor.
- Listener global do Windows agora volta a aceitar um novo gatilho digitado logo apos limpar o estado interno ao sair do manager, encerrar uma expansao ou interromper uma captura, evitando casos em que sequencias como `/1` deixavam de expandir.
- Limpeza de campos com atalhos de edicao como `Ctrl+A` seguido de `Delete` nao deixa mais o rastreador de gatilhos preso em um contexto invalido no Windows, permitindo novas expansoes imediatamente apos apagar todo o texto.
- Publicacao de releases ajustada para evitar tags sem assets `.msi` e `.exe` no GitHub Releases.
- Verificacao de atualizacao agora explica corretamente quando a API publica do GitHub nao consegue acessar releases de um repositorio privado, em vez de exibir apenas uma falha generica.
- Expansao inline no Windows deixou de falhar para snippets legados ou importados com gatilhos salvos com `/`, normalizando criacao, edicao, importacao e busca no store.
- Modais de categorias agora respeitam a viewport, com scroll interno e sem vazamento horizontal ou vertical da lista de categorias.

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
