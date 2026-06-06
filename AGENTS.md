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
