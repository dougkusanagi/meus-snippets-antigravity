# guepardosys-snip

Aplicativo desktop Picker-first para armazenar e executar snippets e macros de teclado.
Construido com Tauri 2, Rust e JavaScript sem framework.

## Funcionalidades

- Picker global aberto por atalho configuravel.
- Busca por nome, gatilho, categoria e tags.
- Favoritos e ordenacao por frequencia de uso.
- Textos, combinacoes de teclas e esperas entre acoes.
- Variaveis internas:
  - `{{date}}`: data local em `YYYY-MM-DD`.
  - `{{time}}`: horario local.
  - `{{datetime}}`: data e horario local.
  - `{{clipboard}}`: texto atual da area de transferencia.
  - `{{uuid}}`: UUID gerado durante a execucao.
  - `{{cursor}}`: posicao final desejada do cursor.
- Campos preenchiveis, como `{{nome}}`, solicitados pelo picker antes da execucao.
- Categorias, tags, favoritos, contador e data do ultimo uso.
- Preview, duplicacao, importacao e exportacao em JSON.
- Backup local e gravacao atomica dos dados.
- Funcionamento offline, sem fontes ou scripts carregados por CDN.
- Verificacao de atualizacoes via GitHub Releases com CTA para baixar a versao mais recente.

## Desenvolvimento

Pre-requisitos:

- [Bun](https://bun.sh/)
- [Rust](https://rustup.rs/)
- Dependencias de sistema exigidas pelo Tauri 2 para seu sistema operacional.

```powershell
bun install
bun run dev
```

Comandos disponiveis:

```powershell
bun run dev
bun run build
bun run check
bun run test
bun run format
```

## Releases no GitHub

O projeto usa:

- Tags no formato `vX.Y.Z`
- Versionamento SemVer
- `CHANGELOG.md` unico, em ordem da release mais recente para a mais antiga

Fluxo recomendado para publicar uma release:

1. Atualize a versao em `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`.
2. Adicione a nova secao no topo de `CHANGELOG.md` com a data da release e os itens em `Added`, `Changed` e `Fixed`.
3. Valide o projeto:

```powershell
bun run check
bun run build
```

4. Faça commit e push da branch `main`.
5. Crie a tag e publique a release com o GitHub CLI:

```powershell
git tag v0.0.1
git push origin main
git push origin v0.0.1
gh release create v0.0.1 `
  --title "v0.0.1" `
  --notes "Veja o CHANGELOG.md para os detalhes da v0.0.1." `
  src-tauri/target/release/bundle/msi/*.msi `
  src-tauri/target/release/bundle/nsis/*.exe
```

Se quiser publicar sem anexos, remova os caminhos finais do comando `gh release create`.

## Dados

Os snippets ficam no diretorio de dados da aplicacao, em `snippets.json`.

- O formato possui versao para permitir migracoes futuras.
- Antes de substituir o arquivo, o app cria `snippets.json.bak`.
- Um JSON invalido e preservado com nome `snippets.corrupt-<data>.json`.
- A exportacao do manager gera um backup portatil em JSON.

## Plataformas

- Windows: atalho global e simulacao de teclado via Tauri/Enigo.
- macOS: pode exigir permissao de Acessibilidade.
- Linux X11: suporte pelo Enigo.
- Linux Wayland/GNOME: possui fluxo especifico para atalho e interacao remota, com fallback por `uinput`.

## Roadmap

### TODO: expansao automatica por gatilho

O produto atual e intencionalmente **Picker-first**: o usuario abre o picker, busca um
snippet e o executa.

Ainda falta implementar a expansao automatica, por exemplo substituir `/email` enquanto
o usuario digita em qualquer aplicativo. Essa funcionalidade exige uma implementacao e
uma estrategia de permissoes especificas para cada plataforma:

- Windows: hooks globais de teclado.
- macOS: Event Taps e Acessibilidade.
- Linux X11: captura global de eventos.
- Linux Wayland: integracao por compositor/portal, sem assumir que um hook global estara disponivel.

Essa etapa deve ser desenvolvida separadamente para nao comprometer a confiabilidade do
fluxo Picker-first atual.
