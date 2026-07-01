# AGENTS.md

## System Information

- **IMPORTANTE**: Sempre verificar o sistema operacional antes de executar qualquer comando de terminal. **Nunca assumir** que o sistema é baseado em uma distribuição específica (como Fedora, Debian, Ubuntu, etc.).
- Em Linux, use `cat /etc/os-release`, `uname -a` ou equivalentes para identificar a distribuicao e o sistema operacional antes de rodar comandos.
- Em Windows, use `Get-CimInstance Win32_OperatingSystem`, `$PSVersionTable` ou equivalentes antes de escolher comandos e ferramentas.
- Exemplos de gerenciadores de pacotes por distribuição:
  - Fedora/RHEL/CentOS: `dnf`
  - Debian/Ubuntu: `apt`
  - Arch: `pacman`
  - openSUSE: `zypper`
  - macOS: `brew`

## Package Managers & Runtimes

### JavaScript / TypeScript
- Prefer **bun** over npm, npx, or yarn

### Python
- Prefer **uv** for Python package management

## Changelog e Releases

- O projeto usa um unico arquivo `CHANGELOG.md`, sempre em ordem da release mais recente para a mais antiga.
- O `CHANGELOG.md` deve refletir **mudancas que vao para release e sejam relevantes para usuario, distribuicao, compatibilidade ou operacao**.
- Atualize o `CHANGELOG.md` quando a mudanca adicionar funcionalidade, corrigir bug ja presente em versoes distribuidas, alterar UX de forma perceptivel, mudar build, instalacao, compatibilidade, seguranca ou procedimentos operacionais.
- Nao atualize o `CHANGELOG.md` para ruido interno de desenvolvimento, como refactor sem efeito funcional, limpeza de codigo, testes, comentarios, ajustes locais de sintaxe ou correcao de problema introduzido e resolvido antes de chegar a uma release.
- Preferir atualizar o `CHANGELOG.md` no PR que sera mergeado em `main` ou no momento de preparar a release, em vez de registrar toda alteracao local imediatamente.
- Quando for util acumular mudancas antes da versao final, usar uma secao `## [Unreleased]` no topo e promover esse conteudo para `## [vX.Y.Z] - YYYY-MM-DD` ao cortar a release.
- Cada release deve ter uma secao `## [vX.Y.Z] - YYYY-MM-DD`.
- Ao preparar uma mudanca, registrar no changelog o que entrou na versao nova usando linguagem objetiva e orientada ao usuario.
- Dentro de cada release, usar no minimo os blocos `Added`, `Changed` e `Fixed` quando fizer sentido.
- Use:
  - `Added` para novas funcionalidades ou capacidades.
  - `Changed` para mudancas de comportamento, arquitetura, fluxo, build, dependencias ou compatibilidade.
  - `Fixed` para bugs, regressões, falhas de seguranca e correcões operacionais.
- O changelog deve registrar apenas mudancas relevantes para usuario, distribuicao, compatibilidade ou operacao.
- Nao criar uma pasta com um arquivo por release, a menos que o usuario peça explicitamente esse formato.
- Ao concluir uma tarefa, revisar se ela precisa aparecer no `CHANGELOG.md` pelos criterios acima antes de editar o arquivo.

## Versionamento

- O projeto segue versionamento semantico de tres digitos no formato `MAJOR.MINOR.PATCH` (`X.Y.Z`), por exemplo `0.1.2`.
- Significado dos digitos:
  - `MAJOR` (primeiro digito): mudancas drásticas ou estruturais, especialmente quando quebram compatibilidade com versoes anteriores.
  - `MINOR` (segundo digito): novas funcionalidades compatíveis com versoes anteriores.
  - `PATCH` (terceiro digito): correcões, pequenos ajustes, hardening e reparos sem adicionar novas funcionalidades.
- As tags e releases do GitHub devem usar o formato `vX.Y.Z`.
- Antes de criar uma release, alinhar a mesma versao em `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`.
- Sempre que a versao mudar, atualizar tambem o `CHANGELOG.md` na secao correspondente da nova release.
- Enquanto o app estiver pre-1.0:
  - `PATCH`: correcao pequena, docs, ajuste de build, manutencao ou UX sem nova funcionalidade relevante.
  - `MINOR`: nova funcionalidade, mudanca perceptivel no fluxo ou alteracao de comportamento mantendo compatibilidade.
  - `MAJOR`: usar quando houver quebra de compatibilidade ou quando o produto entrar em `1.0.0`, salvo instrucao diferente do usuario.
- Toda nova release deve atualizar o `CHANGELOG.md` antes da tag ser criada.
- Fluxo obrigatorio para qualquer release:
  - definir o proximo numero de versao seguindo `MAJOR.MINOR.PATCH`;
  - atualizar `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`;
  - adicionar ou completar a secao `## [vX.Y.Z] - YYYY-MM-DD` no `CHANGELOG.md`;
  - revisar se `Added`, `Changed` e `Fixed` cobrem corretamente a entrega;
  - somente depois criar tag/release `vX.Y.Z`.
