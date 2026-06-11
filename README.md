# guepardosys-snip

Aplicativo desktop Picker-first para armazenar e executar snippets e macros de teclado.
Construído com Tauri 2, Rust e JavaScript sem framework.

## Funcionalidades

- Picker global aberto por atalho configurável.
- Busca por nome, gatilho, categoria e tags.
- Favoritos e ordenação por frequência de uso.
- Textos, combinações de teclas e esperas entre ações.
- Variáveis internas:
  - `{{date}}`: data local em `YYYY-MM-DD`.
  - `{{time}}`: horário local.
  - `{{datetime}}`: data e horário local.
  - `{{clipboard}}`: texto atual da área de transferência.
  - `{{uuid}}`: UUID gerado durante a execução.
  - `{{cursor}}`: posição final desejada do cursor.
- Campos preenchíveis, como `{{nome}}`, solicitados pelo picker antes da execução.
- Categorias, tags, favoritos, contador e data do último uso.
- Preview, duplicação, importação e exportação em JSON.
- Backup local e gravação atômica dos dados.
- Funcionamento offline, sem fontes ou scripts carregados por CDN.

## Desenvolvimento

Pré-requisitos:

- [Bun](https://bun.sh/)
- [Rust](https://rustup.rs/)
- Dependências de sistema exigidas pelo Tauri 2 para seu sistema operacional.

```powershell
bun install
bun run dev
```

Comandos disponíveis:

```powershell
bun run dev
bun run build
bun run check
bun run test
bun run format
```

## Dados

Os snippets ficam no diretório de dados da aplicação, em `snippets.json`.

- O formato possui versão para permitir migrações futuras.
- Antes de substituir o arquivo, o app cria `snippets.json.bak`.
- Um JSON inválido é preservado com nome `snippets.corrupt-<data>.json`.
- A exportação do manager gera um backup portátil em JSON.

## Plataformas

- Windows: atalho global e simulação de teclado via Tauri/Enigo.
- macOS: pode exigir permissão de Acessibilidade.
- Linux X11: suporte pelo Enigo.
- Linux Wayland/GNOME: possui fluxo específico para atalho e interação remota, com fallback por `uinput`.

## Roadmap

### TODO: expansão automática por gatilho

O produto atual é intencionalmente **Picker-first**: o usuário abre o picker, busca um
snippet e o executa.

Ainda falta implementar a expansão automática, por exemplo substituir `/email` enquanto
o usuário digita em qualquer aplicativo. Essa funcionalidade exige uma implementação e
uma estratégia de permissões específicas para cada plataforma:

- Windows: hooks globais de teclado.
- macOS: Event Taps e Acessibilidade.
- Linux X11: captura global de eventos.
- Linux Wayland: integração por compositor/portal, sem assumir que um hook global estará disponível.

Essa etapa deve ser desenvolvida separadamente para não comprometer a confiabilidade do
fluxo Picker-first atual.
