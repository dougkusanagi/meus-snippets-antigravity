# AGENTS.md

## System Information

- **IMPORTANTE**: Sempre verificar o sistema operacional antes de executar qualquer comando de terminal. **Nunca assumir** que o sistema é baseado em uma distribuição específica (como Fedora, Debian, Ubuntu, etc.).
- Use `cat /etc/os-release`, `uname -a` ou equivalentes para identificar a distribuição e o sistema operacional antes de rodar comandos.
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
- Cada release deve ter uma secao `## [vX.Y.Z] - YYYY-MM-DD`.
- Dentro de cada release, usar no minimo os blocos `Added`, `Changed` e `Fixed` quando fizer sentido.
- O changelog deve registrar apenas mudancas relevantes para usuario, distribuicao, compatibilidade ou operacao.
- Nao criar uma pasta com um arquivo por release, a menos que o usuario peça explicitamente esse formato.

## Versionamento

- As tags e releases do GitHub devem usar o formato `vX.Y.Z`.
- Antes de criar uma release, alinhar a mesma versao em `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`.
- Enquanto o app estiver pre-1.0:
  - `patch`: correcao pequena, docs, ajuste de build ou UX sem nova funcionalidade relevante.
  - `minor`: nova funcionalidade, mudanca perceptivel no fluxo ou alteracao de comportamento.
  - `major`: usar apenas quando o produto entrar em `1.0.0` ou quando o usuario pedir explicitamente outra politica.
- Toda nova release deve atualizar o `CHANGELOG.md` antes da tag ser criada.
