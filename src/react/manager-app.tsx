import { invoke } from '@tauri-apps/api/core';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Eye,
  Folder,
  FolderCog,
  FolderOpen,
  FolderPlus,
  GripVertical,
  HelpCircle,
  House,
  Keyboard,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldAlert,
  Star,
  Trash2,
  Upload,
  X,
  Zap,
  LayoutGrid,
  Package,
  Mail,
  Briefcase,
  CircleDollarSign,
  FileCode,
  HandCoins,
  Handshake,
  Headset,
  User,
  Heart,
  Bookmark,
  Archive,
  ClipboardCheck,
  CreditCard,
  MessageCircleQuestionMark,
  MessageSquareMore,
  MessagesSquare,
  PackageCheck,
  PackageOpen,
  Receipt,
  ShoppingCart,
  Sparkles,
  Truck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import logo from '../assets/guepardosys-snip-logo.png';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import type { Category, CategoryIcon, LibrarySnapshot, MacroAction, Snippet } from '../lib/types';
import { cn } from '../lib/utils';

type Panel = 'empty' | 'editor' | 'settings';
type SortOrder = 'recent' | 'used' | 'name';

type SnippetDraft = {
  id?: string;
  trigger: string;
  name: string;
  categoryId: string | null;
  tags: string;
  favorite: boolean;
  actions: MacroAction[];
};

type PromptState = {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  defaultValue: string;
  onSubmit: (value: string) => Promise<void> | void;
};

type ConfirmState = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
};

type IconState = {
  open: boolean;
  icon: CategoryIcon;
  onSelect: (icon: CategoryIcon) => void;
};

type ImportState = {
  open: boolean;
  path: string;
  source: 'json' | 'textexpander';
  title: string;
  description: string;
};

const shortcutDefaults = {
  mac: 'Command+;',
  other: 'Ctrl+;',
};

const variableTokens = [
  { id: '{{date}}', label: 'Data' },
  { id: '{{time}}', label: 'Hora' },
  { id: '{{datetime}}', label: 'Data e hora' },
  { id: '{{clipboard}}', label: 'Área de transferência' },
  { id: '{{uuid}}', label: 'UUID' },
  { id: '{{cursor}}', label: 'Cursor' },
];

const lucideIconOptions = [
  ['folder', Folder],
  ['folder-open', FolderOpen],
  ['folder-cog', FolderCog],
  ['headset', Headset],
  ['message-circle-question-mark', MessageCircleQuestionMark],
  ['messages-square', MessagesSquare],
  ['message-square-more', MessageSquareMore],
  ['truck', Truck],
  ['package-check', PackageCheck],
  ['package-open', PackageOpen],
  ['sparkles', Sparkles],
  ['credit-card', CreditCard],
  ['receipt', Receipt],
  ['circle-dollar-sign', CircleDollarSign],
  ['hand-coins', HandCoins],
  ['handshake', Handshake],
  ['shopping-cart', ShoppingCart],
  ['clipboard-check', ClipboardCheck],
  ['briefcase', Briefcase],
  ['mail', Mail],
  ['package', Package],
  ['layout-grid', LayoutGrid],
  ['file-code', FileCode],
  ['user', User],
  ['heart', Heart],
  ['bookmark', Bookmark],
  ['archive', Archive],
] as const;

const lucideIconMap = Object.fromEntries(lucideIconOptions) as Record<string, React.ComponentType<{ className?: string }>>;

function getLucideIcon(name: string) {
  return lucideIconMap[name] || Folder;
}

const macroCommandButtons = [
  { label: 'Enter', token: '[[Enter]]' },
  { label: 'Tab', token: '[[Tab]]' },
  { label: 'Shift+Tab', token: '[[Shift+Tab]]' },
  { label: 'Backspace', token: '[[Backspace]]' },
  { label: 'Del', token: '[[Delete]]' },
  { label: 'Esc', token: '[[Escape]]' },
  { label: '↑', token: '[[Up]]' },
  { label: '↓', token: '[[Down]]' },
  { label: '←', token: '[[Left]]' },
  { label: '→', token: '[[Right]]' },
  { label: 'Home', token: '[[Home]]' },
  { label: 'End', token: '[[End]]' },
  { label: 'Ctrl+A', token: '[[Ctrl+A]]' },
  { label: 'Ctrl+C', token: '[[Ctrl+C]]' },
  { label: 'Ctrl+V', token: '[[Ctrl+V]]' },
  { label: 'Ctrl+X', token: '[[Ctrl+X]]' },
  { label: 'Ctrl+Z', token: '[[Ctrl+Z]]' },
  { label: 'Ctrl+Y', token: '[[Ctrl+Y]]' },
  { label: 'Ctrl+Shift+V', token: '[[Ctrl+Shift+V]]' },
  { label: 'Alt+Tab', token: '[[Alt+Tab]]' },
  { label: 'Espera 300ms', token: '[[delay:300]]' },
] as const;

function normalizeMacroModifier(value: string) {
  const lower = value.trim().toLowerCase();
  if (lower === 'ctrl' || lower === 'control') return 'Ctrl';
  if (lower === 'shift') return 'Shift';
  if (lower === 'alt') return 'Alt';
  if (lower === 'cmd' || lower === 'meta' || lower === 'super') return 'Meta';
  return null;
}

function normalizeMacroKey(value: string) {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const aliases: Record<string, string> = {
    enter: 'Enter',
    return: 'Enter',
    tab: 'Tab',
    backspace: 'Backspace',
    delete: 'Delete',
    del: 'Delete',
    escape: 'Escape',
    esc: 'Escape',
    up: 'Up',
    arrowup: 'Up',
    down: 'Down',
    arrowdown: 'Down',
    left: 'Left',
    arrowleft: 'Left',
    right: 'Right',
    arrowright: 'Right',
    home: 'Home',
    end: 'End',
    pageup: 'PageUp',
    pagedown: 'PageDown',
    space: 'Space',
  };

  if (aliases[lower]) return aliases[lower];
  if (trimmed.length === 1) return trimmed.toUpperCase();
  return null;
}

function parseMacroToken(token: string): MacroAction | null {
  const delayMatch = token.match(/^delay\s*:\s*(\d+)$/i);
  if (delayMatch) {
    return { type: 'delay', milliseconds: Number(delayMatch[1]) };
  }

  const parts = token
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return null;

  const key = normalizeMacroKey(parts.at(-1) || '');
  if (!key) return null;

  const modifiers = parts.slice(0, -1).map(normalizeMacroModifier);
  if (modifiers.some((item) => !item)) return null;

  return {
    type: 'key',
    key,
    modifiers: Array.from(new Set(modifiers.filter(Boolean) as string[])),
  };
}

function compactMacroActions(actions: MacroAction[]) {
  const compacted: MacroAction[] = [];
  for (const action of actions) {
    if (action.type === 'text' && compacted.at(-1)?.type === 'text') {
      const previous = compacted[compacted.length - 1] as Extract<MacroAction, { type: 'text' }>;
      previous.value += action.value;
      continue;
    }
    compacted.push(action);
  }
  return compacted.length ? compacted : [{ type: 'text', value: '' }];
}

function parseMacroScript(script: string): MacroAction[] {
  const actions: MacroAction[] = [];
  const tokenRegex = /\[\[([\s\S]+?)\]\]/g;
  let cursor = 0;

  for (const match of script.matchAll(tokenRegex)) {
    const [raw, body] = match;
    const index = match.index ?? 0;
    if (index > cursor) {
      actions.push({ type: 'text', value: script.slice(cursor, index) });
    }
    const parsed = parseMacroToken(body.trim());
    if (parsed) {
      actions.push(parsed);
    } else {
      actions.push({ type: 'text', value: raw });
    }
    cursor = index + raw.length;
  }

  if (cursor < script.length) {
    actions.push({ type: 'text', value: script.slice(cursor) });
  }

  return compactMacroActions(actions);
}

function serializeMacroActions(actions: MacroAction[]) {
  if (!actions.length) return '';
  return actions
    .map((action) => {
      if (action.type === 'text') return action.value;
      if (action.type === 'delay') return `[[delay:${action.milliseconds}]]`;
      const combo = [...(action.modifiers || []), action.key].join('+');
      return `[[${combo}]]`;
    })
    .join('');
}

type MacroVisualSegment =
  | { kind: 'text'; value: string }
  | { kind: 'token'; raw: string; label: string };

function getMacroTokenLabel(rawToken: string) {
  const variable = variableTokens.find((item) => item.id === rawToken);
  if (variable) return variable.label;
  const command = macroCommandButtons.find((item) => item.token === rawToken);
  if (command) return command.label;
  const delayMatch = rawToken.match(/^\[\[delay:(\d+)\]\]$/i);
  if (delayMatch) return `Espera ${delayMatch[1]}ms`;
  const comboMatch = rawToken.match(/^\[\[([\s\S]+)\]\]$/);
  return comboMatch ? comboMatch[1] : rawToken;
}

function toMacroVisualSegments(script: string): MacroVisualSegment[] {
  const segments: MacroVisualSegment[] = [];
  const tokenRegex = /(\[\[[\s\S]+?\]\]|\{\{(?:date|time|datetime|clipboard|uuid|cursor)\}\})/g;
  let cursor = 0;

  for (const match of script.matchAll(tokenRegex)) {
    const [raw] = match;
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ kind: 'text', value: script.slice(cursor, index) });
    }
    if (raw.startsWith('{{') || parseMacroToken(raw.slice(2, -2).trim())) {
      segments.push({ kind: 'token', raw, label: getMacroTokenLabel(raw) });
    } else {
      segments.push({ kind: 'text', value: raw });
    }
    cursor = index + raw.length;
  }

  if (cursor < script.length) {
    segments.push({ kind: 'text', value: script.slice(cursor) });
  }

  if (!segments.length) {
    segments.push({ kind: 'text', value: '' });
  }

  return segments;
}

function emptyDraft(): SnippetDraft {
  return {
    trigger: '',
    name: '',
    categoryId: null,
    tags: '',
    favorite: false,
    actions: [{ type: 'text', value: '' }],
  };
}

function toDraft(snippet: Snippet): SnippetDraft {
  return {
    id: snippet.id,
    trigger: snippet.trigger,
    name: snippet.name,
    categoryId: snippet.categoryId,
    tags: snippet.tags.join(', '),
    favorite: snippet.favorite,
    actions: snippet.actions.length ? snippet.actions : [{ type: 'text', value: '' }],
  };
}

function formatShortcutForDisplay(shortcut: string, isMac: boolean) {
  return String(shortcut || '')
    .replace(/CommandOrControl/gi, isMac ? 'Cmd' : 'Ctrl')
    .replace(/Command/gi, 'Cmd')
    .replace(/Meta/gi, isMac ? 'Cmd' : 'Win')
    .replace(/Super/gi, isMac ? 'Cmd' : 'Win');
}

function getPhysicalKeyName(code: string) {
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    Semicolon: 'Semicolon',
    Comma: 'Comma',
    Period: 'Period',
    Slash: 'Slash',
    Equal: 'Equal',
    Minus: 'Minus',
    BracketLeft: 'BracketLeft',
    BracketRight: 'BracketRight',
    Quote: 'Quote',
    Backquote: 'Backquote',
    Backslash: 'Backslash',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Space: 'Space',
    Enter: 'Enter',
    Escape: 'Escape',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
  };
  return map[code] || code;
}

function getDisplayKeyName(event: React.KeyboardEvent | KeyboardEvent) {
  const named: Record<string, string> = {
    ' ': 'Space',
    Space: 'Space',
    Enter: 'Enter',
    Escape: 'Esc',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Del',
    Insert: 'Ins',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
  };
  const code = event.code;
  const key = event.key;
  if (named[code]) return named[code];
  if (named[key]) return named[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

async function coreInvoke<T>(command: string, args?: Record<string, unknown>) {
  return invoke<T>(command, args);
}

export function ManagerApp() {
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [panel, setPanel] = useState<Panel>('empty');
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [search, setSearch] = useState('');
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SnippetDraft>(emptyDraft());
  const [draggedSnippetId, setDraggedSnippetId] = useState<string | null>(null);
  const [snippetDropCategoryId, setSnippetDropCategoryId] = useState<string | null>(null);
  const [shortcutDisplay, setShortcutDisplay] = useState('Carregando...');
  const [recordingShortcut, setRecordingShortcut] = useState(false);
  const [updateStatus, setUpdateStatus] = useState({
    title: 'Verificando atualizações...',
    description: 'Comparando a versão instalada com a release mais recente.',
    latestUrl: '',
    canDownload: false,
  });
  const [permissionInfo, setPermissionInfo] = useState<{
    title: string;
    description: string;
    visible: boolean;
  }>({ title: '', description: '', visible: false });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryDialogParentId, setCategoryDialogParentId] = useState<string | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [iconState, setIconState] = useState<IconState | null>(null);
  const [iconTab, setIconTab] = useState<'lucide' | 'emoji'>('lucide');
  const [iconSearch, setIconSearch] = useState('');
  const [emojiValue, setEmojiValue] = useState('📁');
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [categoryPickerMode, setCategoryPickerMode] = useState<'manage' | 'pick'>('manage');
  const [conflictText, setConflictText] = useState('');
  const shortcutRef = useRef<HTMLButtonElement | null>(null);

  const selectedSnippet = useMemo(
    () => snippets.find((snippet) => snippet.id === selectedSnippetId) ?? null,
    [selectedSnippetId, snippets]
  );

  const currentCategory = useMemo(
    () => categories.find((category) => category.id === currentCategoryId) ?? null,
    [categories, currentCategoryId]
  );

  const visibleCategories = useMemo(() => {
    if (search.trim()) return [];
    const filtered = categories.filter((category) => (category.parentId || null) === (currentCategoryId || null));
    const sortMode = currentCategory?.sortMode ?? 'manual';
    return [...filtered].sort((a, b) => {
      if (sortMode === 'alphabetical') return a.name.localeCompare(b.name, 'pt-BR');
      if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [categories, currentCategory, currentCategoryId, search]);

  const visibleSnippets = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? snippets.filter((snippet) =>
        snippet.trigger.toLowerCase().includes(query) ||
        snippet.name.toLowerCase().includes(query) ||
        snippet.categoryPath.toLowerCase().includes(query) ||
        snippet.tags.some((tag) => tag.toLowerCase().includes(query))
      )
      : snippets.filter((snippet) => (snippet.categoryId || null) === (currentCategoryId || null));

    return [...list].sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      if (sortOrder === 'used') return (b.usageCount || 0) - (a.usageCount || 0);
      if (sortOrder === 'name') return a.name.localeCompare(b.name, 'pt-BR');
      return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
    });
  }, [currentCategoryId, search, snippets, sortOrder]);

  const categoryDialogCategories = useMemo(() => {
    const filtered = categories.filter((category) => (category.parentId || null) === (categoryDialogParentId || null));
    const parent = categories.find((category) => category.id === categoryDialogParentId) ?? null;
    const sortMode = parent?.sortMode ?? 'manual';
    return [...filtered].sort((a, b) => {
      if (sortMode === 'alphabetical') return a.name.localeCompare(b.name, 'pt-BR');
      if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [categories, categoryDialogParentId]);

  const filteredLucideIcons = useMemo(
    () => lucideIconOptions.filter(([name]) => name.toLowerCase().includes(iconSearch.toLowerCase())),
    [iconSearch]
  );

  const canDragSnippetsToCategory = !search.trim() && currentCategoryId === null;
  const categorySelectOptions = useMemo(
    () =>
      [...categories]
        .map((category) => ({
          id: category.id,
          path: getCategoryPath(category.id) || category.name,
        }))
        .sort((a, b) => a.path.localeCompare(b.path, 'pt-BR')),
    [categories]
  );

  function getCategoryById(id: string | null) {
    return categories.find((category) => category.id === id) ?? null;
  }

  function getCategoryPath(id: string | null) {
    if (!id) return '';
    const names: string[] = [];
    let cursor = getCategoryById(id);
    while (cursor) {
      names.push(cursor.name);
      cursor = getCategoryById(cursor.parentId);
    }
    return names.reverse().join(' / ');
  }

  async function loadSnapshot(selectSnippetId?: string | null) {
    try {
      const snapshot = await coreInvoke<LibrarySnapshot>('get_library_snapshot');
      setSnippets(snapshot.snippets);
      setCategories(snapshot.categories);

      const stillExists = (id: string | null | undefined) => snapshot.snippets.some((snippet) => snippet.id === id);
      if (selectSnippetId && stillExists(selectSnippetId)) {
        const snippet = snapshot.snippets.find((item) => item.id === selectSnippetId)!;
        setSelectedSnippetId(snippet.id);
        setDraft(toDraft(snippet));
        setPanel('editor');
      } else if (selectedSnippetId && !stillExists(selectedSnippetId)) {
        setSelectedSnippetId(null);
        setDraft(emptyDraft());
        setPanel('empty');
      }
    } catch (error) {
      console.error(error);
      toast.error(`Erro ao carregar snippets: ${String(error)}`);
    }
  }

  async function loadSettings() {
    try {
      const config = await coreInvoke<{ shortcut: string; display: string }>('get_shortcut');
      setShortcutDisplay(config.display || formatShortcutForDisplay(config.shortcut, isMac));
      await checkConflicts();
    } catch (error) {
      console.error(error);
      setShortcutDisplay(isMac ? 'Command+;' : 'Ctrl+;');
    }
  }

  async function checkForUpdates(silent = true) {
    setUpdateStatus((state) => ({
      ...state,
      title: 'Verificando atualizações...',
      description: 'Comparando a versão instalada com a release mais recente no GitHub.',
    }));
    try {
      const currentVersion = await coreInvoke<string>('get_app_version');
      const response = await fetch('https://api.github.com/repos/dougkusanagi/meus-snippets-antigravity/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`GitHub respondeu com status ${response.status}`);
      const release = await response.json();
      const latestVersion = String(release.tag_name || release.name || '');
      const latestUrl = String(release.html_url || 'https://github.com/dougkusanagi/meus-snippets-antigravity/releases');

      const normalize = (value: string) => value.replace(/^v/i, '').split('.').map((part) => parseInt(part, 10) || 0);
      const [a1, a2, a3] = normalize(currentVersion);
      const [b1, b2, b3] = normalize(latestVersion);
      const newer = b1 > a1 || (b1 === a1 && (b2 > a2 || (b2 === a2 && b3 > a3)));

      setUpdateStatus({
        latestUrl,
        canDownload: newer,
        title: newer ? 'Nova atualização disponível' : 'Você já está na versão mais recente',
        description: newer
          ? `Versão atual ${currentVersion}. Nova versão ${latestVersion} disponível no GitHub.`
          : `Versão instalada ${currentVersion}. Nenhuma atualização nova encontrada agora.`,
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      const isPrivateReleaseApi = message.includes('status 404');
      setUpdateStatus({
        title: isPrivateReleaseApi ? 'Verificação automática indisponível' : 'Não foi possível verificar atualizações',
        description: isPrivateReleaseApi
          ? 'O repositório de releases está privado, então o app não consegue consultar a última versão pela API pública do GitHub. Abra a página de releases no navegador se você tiver acesso.'
          : 'Falha ao consultar o GitHub Releases. Tente novamente em alguns instantes.',
        latestUrl: 'https://github.com/dougkusanagi/meus-snippets-antigravity/releases',
        canDownload: isPrivateReleaseApi,
      });
      if (!silent) toast.error(isPrivateReleaseApi ? 'Verificação automática indisponível para releases privadas.' : 'Não foi possível verificar atualizações.');
    }
  }

  async function checkPlatform() {
    try {
      const info = await coreInvoke<{
        needsPermission: boolean;
        permissionType: string;
      }>('get_platform_info');
      if (!info.needsPermission) {
        setPermissionInfo({ title: '', description: '', visible: false });
        return;
      }
      if (info.permissionType === 'linux-wayland') {
        setPermissionInfo({
          title: 'Atalhos Globais & Teclado no Linux Wayland',
          description:
            'Cadastre o atalho do app nas configurações do sistema e conceda a permissão de Controle Remoto quando solicitado.',
          visible: true,
        });
      } else {
        setPermissionInfo({
          title: 'Acessibilidade no macOS',
          description: 'Para expandir snippets, o aplicativo precisa de permissão de Acessibilidade.',
          visible: true,
        });
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function checkConflicts() {
    try {
      const conflicts = await coreInvoke<{ hasAltSpaceConflict: boolean; hasCtrlSemicolonConflict: boolean }>(
        'check_keyboard_conflicts'
      );
      if (conflicts.hasAltSpaceConflict && conflicts.hasCtrlSemicolonConflict) {
        setConflictText('Alt+Espaço e Ctrl+; estão reservados pelo GNOME/IBus.');
      } else if (conflicts.hasAltSpaceConflict) {
        setConflictText('Alt+Espaço está reservado pelo GNOME.');
      } else if (conflicts.hasCtrlSemicolonConflict) {
        setConflictText('Ctrl+; está reservado pelo GNOME/IBus.');
      } else {
        setConflictText('');
      }
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    void loadSnapshot();
    void loadSettings();
    void checkForUpdates();
    void checkPlatform();
  }, []);

  function openNewSnippet() {
    setSelectedSnippetId(null);
    setDraft(emptyDraft());
    setPanel('editor');
  }

  function openSnippet(snippet: Snippet) {
    setSelectedSnippetId(snippet.id);
    setDraft(toDraft(snippet));
    setPanel('editor');
  }

  async function saveSnippet() {
    if (!draft.trigger.trim()) {
      toast.error('O gatilho é obrigatório.');
      return;
    }
    if (!draft.name.trim()) {
      toast.error('O nome é obrigatório.');
      return;
    }
    if (!draft.actions.length) {
      toast.error('Adicione pelo menos uma ação.');
      return;
    }
    const payload = {
      trigger: draft.trigger.trim(),
      name: draft.name.trim(),
      categoryId: draft.categoryId,
      tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      favorite: draft.favorite,
      actions: draft.actions,
    };
    try {
      if (draft.id) {
        await coreInvoke('update_snippet', { id: draft.id, ...payload });
        toast.success('Snippet atualizado.');
        await loadSnapshot(draft.id);
      } else {
        const created = await coreInvoke<{ id: string }>('add_snippet', payload);
        toast.success('Snippet criado com sucesso.');
        await loadSnapshot(created.id);
      }
    } catch (error) {
      console.error(error);
      toast.error(`Erro ao salvar: ${String(error)}`);
    }
  }

  async function deleteSnippet() {
    if (!draft.id) return;
    setConfirmState({
      open: true,
      title: 'Remover snippet?',
      description: `Esta ação removerá "${draft.name}" permanentemente.`,
      destructive: true,
      confirmLabel: 'Remover',
      onConfirm: async () => {
        await coreInvoke('delete_snippet', { id: draft.id });
        toast.success('Snippet removido.');
        setSelectedSnippetId(null);
        setDraft(emptyDraft());
        setPanel('empty');
        await loadSnapshot();
      },
    });
  }

  async function duplicateSnippet() {
    if (!draft.id) return;
    try {
      const duplicate = await coreInvoke<{ id: string }>('duplicate_snippet', { id: draft.id });
      toast.success('Snippet duplicado.');
      await loadSnapshot(duplicate.id);
    } catch (error) {
      toast.error(`Erro ao duplicar: ${String(error)}`);
    }
  }

  async function toggleFavorite() {
    if (!draft.id) {
      setDraft((state) => ({ ...state, favorite: !state.favorite }));
      return;
    }
    try {
      await coreInvoke('set_snippet_favorite', { id: draft.id, favorite: !draft.favorite });
      setDraft((state) => ({ ...state, favorite: !state.favorite }));
      await loadSnapshot(draft.id);
    } catch (error) {
      toast.error(`Erro ao atualizar favorito: ${String(error)}`);
    }
  }

  function openCategoryPicker(mode: 'manage' | 'pick') {
    setCategoryPickerMode(mode);
    setCategoryDialogParentId(mode === 'pick' ? draft.categoryId ?? null : currentCategoryId);
    setCategoryDialogOpen(true);
  }

  async function handleSidebarCategoryDrop(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = visibleCategories.map((category) => category.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    try {
      await coreInvoke('reorder_categories', { parentId: currentCategoryId, orderedIds: next });
      await loadSnapshot(selectedSnippetId);
    } catch (error) {
      toast.error(`Erro ao reordenar categorias: ${String(error)}`);
    }
  }

  async function moveSnippetToCategory(snippetId: string, categoryId: string) {
    const snippet = snippets.find((item) => item.id === snippetId);
    if (!snippet || snippet.categoryId === categoryId) return;

    try {
      await coreInvoke('update_snippet', {
        id: snippet.id,
        trigger: snippet.trigger,
        name: snippet.name,
        categoryId,
        tags: snippet.tags,
        favorite: snippet.favorite,
        actions: snippet.actions,
      });
      toast.success('Snippet movido para a categoria.');
      await loadSnapshot(selectedSnippetId ?? snippet.id);
    } catch (error) {
      toast.error(`Erro ao mover snippet: ${String(error)}`);
    } finally {
      setDraggedSnippetId(null);
      setSnippetDropCategoryId(null);
    }
  }

  async function handleDialogCategoryDrop(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = categoryDialogCategories.map((category) => category.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    try {
      await coreInvoke('reorder_categories', { parentId: categoryDialogParentId, orderedIds: next });
      await loadSnapshot(selectedSnippetId);
    } catch (error) {
      toast.error(`Erro ao reordenar categorias: ${String(error)}`);
    }
  }

  async function setSortMode(nextMode: 'manual' | 'alphabetical') {
    try {
      await coreInvoke('set_category_sort_mode', { parentId: currentCategoryId, sortMode: nextMode });
      await loadSnapshot(selectedSnippetId);
    } catch (error) {
      toast.error(`Erro ao alterar ordenação: ${String(error)}`);
    }
  }

  function openCreateCategory() {
    setPromptState({
      open: true,
      title: 'Nova categoria',
      description: 'Crie uma categoria no nível atual.',
      label: 'Nome da categoria',
      defaultValue: '',
      onSubmit: async (value) => {
        const selectedIcon = await chooseIcon({ kind: 'lucide', value: 'folder' });
        if (!selectedIcon) return;
        await coreInvoke('create_category', { name: value, parentId: categoryDialogParentId, icon: selectedIcon });
        toast.success('Categoria criada.');
        await loadSnapshot(selectedSnippetId);
      },
    });
  }

  function openRenameCategory(category: Category) {
    setPromptState({
      open: true,
      title: 'Renomear categoria',
      label: 'Nome da categoria',
      defaultValue: category.name,
      onSubmit: async (value) => {
        await coreInvoke('update_category', {
          id: category.id,
          name: value,
          parentId: category.parentId,
          icon: category.icon,
        });
        toast.success('Categoria atualizada.');
        await loadSnapshot(selectedSnippetId);
      },
    });
  }

  function chooseIcon(initial: CategoryIcon) {
    return new Promise<CategoryIcon | null>((resolve) => {
      setIconSearch('');
      setIconTab(initial.kind);
      setEmojiValue(initial.kind === 'emoji' ? initial.value : '📁');
      setIconState({
        open: true,
        icon: initial,
        onSelect: (icon) => resolve(icon),
      });
    });
  }

  function openDeleteCategory(category: Category) {
    setConfirmState({
      open: true,
      title: 'Excluir categoria?',
      description: `A categoria "${category.name}" será removida se estiver vazia e sem subcategorias.`,
      destructive: true,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        await coreInvoke('delete_category', { id: category.id });
        toast.success('Categoria removida.');
        if (draft.categoryId === category.id) {
          setDraft((state) => ({ ...state, categoryId: null }));
        }
        await loadSnapshot(selectedSnippetId);
      },
    });
  }

  async function exportBackup() {
    try {
      const path = await coreInvoke<string | null>('choose_backup_export_path', {
        suggestedName: `guepardosys-snip-backup-${new Date().toISOString().slice(0, 10)}.json`,
      });
      if (!path) return;
      await coreInvoke('export_backup_to_file', { path });
      toast.success('Backup exportado.');
    } catch (error) {
      toast.error(`Erro ao exportar: ${String(error)}`);
    }
  }

  async function importBackup() {
    try {
      const path = await coreInvoke<string | null>('choose_backup_import_path');
      if (!path) return;
      setImportState({
        open: true,
        path,
        source: 'json',
        title: 'Importar backup',
        description: 'Escolha se deseja mesclar o backup com os snippets atuais ou substituir tudo.',
      });
    } catch (error) {
      toast.error(`Erro ao escolher backup: ${String(error)}`);
    }
  }

  async function importTextExpander() {
    try {
      const path = await coreInvoke<string | null>('choose_textexpander_import_path');
      if (!path) return;
      setImportState({
        open: true,
        path,
        source: 'textexpander',
        title: 'Importar do TextExpander',
        description: 'Escolha se deseja mesclar o CSV exportado pelo TextExpander com os snippets atuais ou substituir tudo.',
      });
    } catch (error) {
      toast.error(`Erro ao escolher CSV do TextExpander: ${String(error)}`);
    }
  }

  async function finishImport(replace: boolean) {
    if (!importState) return;
    try {
      const command =
        importState.source === 'textexpander'
          ? 'import_textexpander_csv_from_file'
          : 'import_backup_from_file';
      const count = await coreInvoke<number>(command, { path: importState.path, replace });
      toast.success(`${count} snippet(s) importado(s).`);
      setImportState(null);
      setPanel('empty');
      setSelectedSnippetId(null);
      setDraft(emptyDraft());
      await loadSnapshot();
    } catch (error) {
      toast.error(`Erro ao importar: ${String(error)}`);
    }
  }

  function confirmReplaceImport() {
    if (!importState) return;
    const sourceLabel = importState.source === 'textexpander' ? 'o CSV do TextExpander' : 'o backup JSON';
    setConfirmState({
      open: true,
      title: 'Apagar snippets atuais?',
      description: `Essa ação vai apagar toda a biblioteca atual de snippets e categorias antes de importar ${sourceLabel}. Essa operação substitui tudo.`,
      confirmLabel: 'Apagar biblioteca e importar',
      destructive: true,
      onConfirm: async () => {
        await finishImport(true);
      },
    });
  }

  async function saveShortcut(shortcut: string, display: string) {
    try {
      await coreInvoke('set_shortcut', { shortcut, display });
      setShortcutDisplay(display);
      toast.success('Atalho atualizado com sucesso.');
    } catch (error) {
      toast.error(`Falha ao registrar atalho: ${String(error)}`);
    }
  }

  async function resolveConflicts() {
    try {
      const conflicts = await coreInvoke<{ hasAltSpaceConflict: boolean; hasCtrlSemicolonConflict: boolean }>(
        'check_keyboard_conflicts'
      );
      if (conflicts.hasAltSpaceConflict) {
        await coreInvoke('resolve_keyboard_conflict', { conflictType: 'alt-space' });
      }
      if (conflicts.hasCtrlSemicolonConflict) {
        await coreInvoke('resolve_keyboard_conflict', { conflictType: 'ctrl-semicolon' });
      }
      toast.success('Conflitos resolvidos.');
      await checkConflicts();
    } catch (error) {
      toast.error(`Erro ao resolver conflitos: ${String(error)}`);
    }
  }

  async function handleShortcutFocus() {
    setRecordingShortcut(true);
    try {
      await coreInvoke('set_shortcut_recording_active', { active: true });
      await coreInvoke('disable_global_shortcut');
    } catch (error) {
      console.error(error);
    }
  }

  async function handleShortcutBlur() {
    setRecordingShortcut(false);
    try {
      await coreInvoke('set_shortcut_recording_active', { active: false });
      await coreInvoke('enable_global_shortcut');
    } catch (error) {
      console.error(error);
    }
  }

  async function handleShortcutKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      const parts = [];
      if (event.ctrlKey) parts.push('Ctrl');
      if (event.altKey) parts.push('Alt');
      if (event.shiftKey) parts.push('Shift');
      if (event.metaKey) parts.push(isMac ? 'Cmd' : 'Win');
      setShortcutDisplay(parts.join('+') + '+...');
      return;
    }
    const physicalParts: string[] = [];
    const displayParts: string[] = [];
    if (event.ctrlKey) {
      physicalParts.push('Ctrl');
      displayParts.push('Ctrl');
    }
    if (event.altKey) {
      physicalParts.push('Alt');
      displayParts.push('Alt');
    }
    if (event.shiftKey) {
      physicalParts.push('Shift');
      displayParts.push('Shift');
    }
    if (event.metaKey) {
      physicalParts.push(isMac ? 'Cmd' : 'Win');
      displayParts.push(isMac ? 'Cmd' : 'Win');
    }
    const physicalKey = getPhysicalKeyName(event.code);
    const displayKey = getDisplayKeyName(event);
    physicalParts.push(physicalKey);
    displayParts.push(displayKey);
    const hasModifier = event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
    const isFKey = /^F[1-9][0-2]?$/.test(physicalKey);
    if (!hasModifier && !isFKey) {
      setShortcutDisplay(displayParts.join('+') + ' (adicione modificador)');
      return;
    }
    const shortcut = physicalParts.join('+');
    const display = displayParts.join('+');
    await coreInvoke('set_shortcut_recording_active', { active: false });
    await saveShortcut(shortcut, display);
    shortcutRef.current?.blur();
  }

  async function openSystemSettings() {
    try {
      const result = await coreInvoke<string>('open_system_settings');
      toast.success(result === 'registered' ? 'Atalho cadastrado no sistema.' : 'Configurações abertas.');
    } catch (error) {
      toast.error(`Erro ao abrir configurações: ${String(error)}`);
    }
  }

  const previewLines = draft.actions.map((action) => {
    if (action.type === 'text') return `Texto: ${action.value}`;
    if (action.type === 'delay') return `Espera: ${action.milliseconds} ms`;
    return `Tecla: ${(action.modifiers || []).join('+')}${action.modifiers?.length ? '+' : ''}${action.key}`;
  });

  return (
    <div className="flex h-full bg-transparent text-zinc-100">
      <aside className="flex w-[320px] min-w-[320px] flex-col border-r border-zinc-900 bg-zinc-950/85 backdrop-blur-xl">
        <div className="border-b border-zinc-900 px-4 py-5">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-11 w-11 rounded-xl object-contain" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Macro Expander</div>
              <div className="text-xl font-black tracking-tight text-amber-400">guepardosys-snip</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input className="pl-10" placeholder="Buscar snippets..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Ordenar snippets">
                  <ArrowUpDown className="h-4 w-4 text-zinc-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Ordenar snippets</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                  <DropdownMenuRadioItem value="recent">Mais recentes</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="used">Mais usados</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="name">Nome</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-3 border-b border-zinc-900 px-4 py-3">
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={currentCategoryId ? 'Voltar para pasta anterior' : 'Pasta raiz'}
            disabled={!currentCategoryId}
            onClick={() => setCurrentCategoryId(currentCategory?.parentId ?? null)}
          >
              {currentCategoryId ? <ArrowLeft className="h-4 w-4" /> : <House className="h-4 w-4" />}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Pasta atual</div>
            <div className="truncate text-sm font-semibold">{getCategoryPath(currentCategoryId) || 'Raiz'}</div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3">
            {!visibleCategories.length && !visibleSnippets.length ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/80 px-4 py-8 text-center text-sm text-zinc-500">
                <ClipboardList className="mx-auto mb-3 h-8 w-8 opacity-50" />
                {search.trim() ? 'Nenhum snippet encontrado.' : currentCategoryId ? 'Esta pasta está vazia.' : 'Nenhum snippet ainda.'}
              </div>
            ) : null}

            {!search.trim() && (currentCategory?.sortMode ?? 'manual') === 'manual' ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleSidebarCategoryDrop(event)}>
                <SortableContext items={visibleCategories.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {visibleCategories.map((category) => (
                      <SortableSidebarCategory
                        key={category.id}
                        category={category}
                        onOpen={() => setCurrentCategoryId(category.id)}
                        isSnippetDropTarget={snippetDropCategoryId === category.id}
                        canAcceptSnippetDrop={canDragSnippetsToCategory}
                        onSnippetDragEnter={() => setSnippetDropCategoryId(category.id)}
                        onSnippetDragLeave={() => {
                          setSnippetDropCategoryId((current) => (current === category.id ? null : current));
                        }}
                        onSnippetDrop={() => void (draggedSnippetId ? moveSnippetToCategory(draggedSnippetId, category.id) : Promise.resolve())}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="space-y-2">
                {visibleCategories.map((category) => (
                  <SidebarCategoryCard
                    key={category.id}
                    category={category}
                    onOpen={() => setCurrentCategoryId(category.id)}
                    isSnippetDropTarget={snippetDropCategoryId === category.id}
                    canAcceptSnippetDrop={canDragSnippetsToCategory}
                    onSnippetDragEnter={() => setSnippetDropCategoryId(category.id)}
                    onSnippetDragLeave={() => {
                      setSnippetDropCategoryId((current) => (current === category.id ? null : current));
                    }}
                    onSnippetDrop={() => void (draggedSnippetId ? moveSnippetToCategory(draggedSnippetId, category.id) : Promise.resolve())}
                  />
                ))}
              </div>
            )}

            <div className="mt-3 space-y-2">
              {visibleSnippets.map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  onClick={() => openSnippet(snippet)}
                  draggable={canDragSnippetsToCategory}
                  onDragStart={() => setDraggedSnippetId(snippet.id)}
                  onDragEnd={() => {
                    setDraggedSnippetId(null);
                    setSnippetDropCategoryId(null);
                  }}
                  className={cn(
                    'block w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                    selectedSnippetId === snippet.id
                      ? 'border-amber-500/70 bg-amber-500/10'
                      : 'border-zinc-900 bg-zinc-950/80 hover:border-zinc-700 hover:bg-zinc-900',
                    canDragSnippetsToCategory && 'cursor-grab active:cursor-grabbing'
                  )}
                >
                  <div className="font-mono text-sm font-bold text-amber-400">{snippet.favorite ? '★ ' : ''}{snippet.trigger}</div>
                  <div className="mt-1 text-sm font-medium">{snippet.name}</div>
                  <div className="mt-2 text-xs text-zinc-500">{snippet.categoryPath || 'Sem categoria'} · {snippet.usageCount || 0} usos</div>
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>

        <div className="border-t border-zinc-900 bg-black/20 p-3">
          <div className="flex items-center gap-2">
            <Button className="flex-1" onClick={openNewSnippet}>
              <Zap className="h-4 w-4" />
              Novo Snippet
            </Button>
            <Button variant="secondary" size="icon" onClick={() => openCategoryPicker('manage')}>
              <FolderCog className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => { setPanel('settings'); void loadSettings(); }}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden bg-[#0b0d14]">
        {permissionInfo.visible ? (
          <div className="border-b border-amber-900/40 bg-amber-950/30 px-6 py-4">
            <div className="flex items-start gap-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">{permissionInfo.title}</div>
                <p className="mt-1 text-sm text-zinc-300">{permissionInfo.description}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void openSystemSettings()}>
                Configurar
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setPermissionInfo((state) => ({ ...state, visible: false }))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {panel === 'empty' ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-zinc-400">
            <Keyboard className="h-12 w-12 opacity-40" />
            <div className="text-2xl font-bold text-white">Selecione ou crie um snippet</div>
            <p className="max-w-lg text-sm">Escolha um snippet na lista ao lado para editar, ou clique em “Novo Snippet” para criar um.</p>
          </div>
        ) : null}

        {panel === 'editor' ? (
          <ScrollArea className="h-full">
            <div className="mx-auto max-w-6xl px-7 py-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-3xl font-black tracking-tight">{draft.id ? 'Editar Snippet' : 'Novo Snippet'}</h1>
                <div className="flex flex-wrap gap-2">
                  <Button variant={draft.favorite ? 'default' : 'secondary'} size="icon" onClick={() => void toggleFavorite()}>
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" onClick={() => void duplicateSnippet()} disabled={!draft.id}>
                    <Copy className="h-4 w-4" />
                    Duplicar
                  </Button>
                  <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  <Button variant="destructive" onClick={() => void deleteSnippet()} disabled={!draft.id}>
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                  <Button onClick={() => void saveSnippet()}>
                    <Save className="h-4 w-4" />
                    Salvar
                  </Button>
                </div>
              </div>

              <div className="mt-8 space-y-6">
                <LabeledField label="Gatilho">
                  <Input value={draft.trigger} onChange={(e) => setDraft((state) => ({ ...state, trigger: e.target.value }))} placeholder="/meu-comando" />
                </LabeledField>

                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <LabeledField label="Categoria">
                    <Select
                      value={draft.categoryId ?? '__none__'}
                      onValueChange={(value) =>
                        setDraft((state) => ({
                          ...state,
                          categoryId: value === '__none__' ? null : value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sem categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem categoria</SelectItem>
                        {categorySelectOptions.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.path}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </LabeledField>
                  <LabeledField label="Tags">
                    <Input value={draft.tags} onChange={(e) => setDraft((state) => ({ ...state, tags: e.target.value }))} placeholder="email, suporte, vendas" />
                  </LabeledField>
                </div>

                <LabeledField label="Nome">
                  <Input value={draft.name} onChange={(e) => setDraft((state) => ({ ...state, name: e.target.value }))} placeholder="Nome descritivo do snippet" />
                </LabeledField>

                <LabeledField label="Ações (Macro)">
                  <MacroActionEditor actions={draft.actions} onChange={(actions) => setDraft((state) => ({ ...state, actions }))} />
                </LabeledField>
              </div>
            </div>
          </ScrollArea>
        ) : null}

        {panel === 'settings' ? (
          <ScrollArea className="h-full">
            <div className="mx-auto max-w-4xl px-7 py-7">
              <h1 className="text-3xl font-black tracking-tight">Configurações do Aplicativo</h1>

              <div className="mt-8 grid gap-6">
                <SettingsCard title="Atalho Global do Spotlight" description="Clique abaixo e pressione a combinação de teclas desejada.">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      ref={shortcutRef}
                      variant={recordingShortcut ? 'default' : 'secondary'}
                      className="min-w-[260px] justify-center"
                      onFocus={() => void handleShortcutFocus()}
                      onBlur={() => void handleShortcutBlur()}
                      onKeyDown={(event) => void handleShortcutKeyDown(event)}
                    >
                      {shortcutDisplay}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void saveShortcut(isMac ? shortcutDefaults.mac : shortcutDefaults.other, isMac ? shortcutDefaults.mac : shortcutDefaults.other)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restaurar Padrão
                    </Button>
                  </div>
                  {conflictText ? (
                    <div className="mt-4 rounded-2xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-200">
                      <div className="font-semibold">Conflito de atalhos detectado</div>
                      <p className="mt-1 text-red-300/90">{conflictText}</p>
                      <Button variant="destructive" size="sm" className="mt-3" onClick={() => void resolveConflicts()}>
                        Resolver automaticamente
                      </Button>
                    </div>
                  ) : null}
                </SettingsCard>

                <SettingsCard title="Atualizações" description="O app consulta a última release publicada no GitHub.">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
                    <div className="text-sm font-semibold text-white">{updateStatus.title}</div>
                    <p className="mt-2 text-sm text-zinc-400">{updateStatus.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => void checkForUpdates(false)}>
                        <RefreshCw className="h-4 w-4" />
                        Verificar agora
                      </Button>
                      {updateStatus.canDownload ? (
                        <Button variant="default" onClick={() => void coreInvoke('open_external_url', { url: updateStatus.latestUrl })}>
                          <Download className="h-4 w-4" />
                          Baixar atualização
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard title="Backup e restauração" description="Exporte todos os snippets em JSON ou importe um backup.">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => void exportBackup()}>
                      <Download className="h-4 w-4" />
                      Exportar JSON
                    </Button>
                    <Button variant="secondary" onClick={() => void importBackup()}>
                      <Upload className="h-4 w-4" />
                      Importar JSON
                    </Button>
                    <Button variant="secondary" onClick={() => void importTextExpander()}>
                      <Upload className="h-4 w-4" />
                      Importar TextExpander CSV
                    </Button>
                  </div>
                </SettingsCard>

                <SettingsCard title="Permissões do sistema" description="Abra as configurações do sistema para revisar permissões ou atalhos.">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => void openSystemSettings()}>
                      <ShieldAlert className="h-4 w-4" />
                      Abrir configurações
                    </Button>
                    <Button variant="ghost" onClick={() => setPanel(selectedSnippet ? 'editor' : 'empty')}>
                      <HelpCircle className="h-4 w-4" />
                      Voltar ao manager
                    </Button>
                  </div>
                </SettingsCard>
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </main>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[min(92vw,700px)]">
          <DialogHeader>
            <DialogTitle>Preview da macro</DialogTitle>
            <DialogDescription>Resumo das ações configuradas para o snippet atual.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto px-6 py-5">
            <pre className="whitespace-pre-wrap text-sm text-zinc-300">{previewLines.join('\n') || 'Nenhuma ação.'}</pre>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="w-[min(94vw,940px)]">
          <DialogHeader>
            <DialogTitle>Gerenciar categorias</DialogTitle>
            <DialogDescription>Navegue por níveis, selecione uma categoria ou reorganize as pastas.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 px-6 pt-2">
            {categoryDialogParentId ? (
              <Button variant="secondary" size="sm" onClick={() => setCategoryDialogParentId(getCategoryById(categoryDialogParentId)?.parentId ?? null)}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Navegando em</div>
              <div className="truncate text-sm font-semibold">{getCategoryPath(categoryDialogParentId) || 'Raiz'}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => openCreateCategory()}>
              <FolderPlus className="h-4 w-4" />
              Nova
            </Button>
            {categoryPickerMode === 'pick' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft((state) => ({ ...state, categoryId: null }));
                  setCategoryDialogOpen(false);
                }}
              >
                Sem categoria
              </Button>
            ) : null}
          </div>
          <div className="px-6 py-5">
            {(getCategoryById(categoryDialogParentId)?.sortMode ?? 'manual') === 'manual' ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDialogCategoryDrop(event)}>
                <SortableContext items={categoryDialogCategories.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {categoryDialogCategories.map((category) => (
                      <SortableCategoryDialogRow
                        key={category.id}
                        category={category}
                        onOpen={() => setCategoryDialogParentId(category.id)}
                        onSelect={() => {
                          setDraft((state) => ({ ...state, categoryId: category.id }));
                          setCategoryDialogOpen(false);
                        }}
                        onRename={() => openRenameCategory(category)}
                        onIcon={async () => {
                          const icon = await chooseIcon(category.icon);
                          if (!icon) return;
                          await coreInvoke('update_category', {
                            id: category.id,
                            name: category.name,
                            parentId: category.parentId,
                            icon,
                          });
                          toast.success('Ícone atualizado.');
                          await loadSnapshot(selectedSnippetId);
                        }}
                        onDelete={() => openDeleteCategory(category)}
                        canSelect={categoryPickerMode === 'pick'}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="space-y-2">
                {categoryDialogCategories.map((category) => (
                  <CategoryDialogRow
                    key={category.id}
                    category={category}
                    onOpen={() => setCategoryDialogParentId(category.id)}
                    onSelect={() => {
                      setDraft((state) => ({ ...state, categoryId: category.id }));
                      setCategoryDialogOpen(false);
                    }}
                    onRename={() => openRenameCategory(category)}
                    onIcon={async () => {
                      const icon = await chooseIcon(category.icon);
                      if (!icon) return;
                      await coreInvoke('update_category', {
                        id: category.id,
                        name: category.name,
                        parentId: category.parentId,
                        icon,
                      });
                      toast.success('Ícone atualizado.');
                      await loadSnapshot(selectedSnippetId);
                    }}
                    onDelete={() => openDeleteCategory(category)}
                    canSelect={categoryPickerMode === 'pick'}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(iconState?.open)} onOpenChange={(open) => !open && setIconState(null)}>
        <DialogContent className="w-[min(92vw,760px)]">
          <DialogHeader>
            <DialogTitle>Escolher ícone</DialogTitle>
            <DialogDescription>Selecione um ícone Lucide ou use um emoji do sistema.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5">
            <div className="flex gap-2">
              <Button variant={iconTab === 'lucide' ? 'default' : 'secondary'} size="sm" onClick={() => setIconTab('lucide')}>
                Lucide
              </Button>
              <Button variant={iconTab === 'emoji' ? 'default' : 'secondary'} size="sm" onClick={() => setIconTab('emoji')}>
                Emoji
              </Button>
            </div>
            {iconTab === 'lucide' ? (
              <div className="mt-4">
                <Input placeholder="Buscar ícone" value={iconSearch} onChange={(e) => setIconSearch(e.target.value)} />
                <div className="mt-4 grid max-h-[44vh] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3 lg:grid-cols-4">
                  {filteredLucideIcons.map(([name, Icon]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        iconState?.onSelect({ kind: 'lucide', value: name });
                        setIconState(null);
                      }}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-colors hover:border-amber-500/50 hover:bg-zinc-800"
                    >
                      <Icon className="h-6 w-6 text-amber-400" />
                      <div className="mt-3 text-sm font-medium">{name}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                <div className="flex gap-3">
                  <Input value={emojiValue} onChange={(e) => setEmojiValue(e.target.value)} maxLength={8} placeholder="😀" />
                  <Button
                    onClick={() => {
                      iconState?.onSelect({ kind: 'emoji', value: emojiValue || '📁' });
                      setIconState(null);
                    }}
                  >
                    Usar emoji
                  </Button>
                </div>
                <div className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-amber-500/30 bg-zinc-900 text-6xl">
                  {emojiValue || '📁'}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PromptDialog
        state={promptState}
        onClose={() => setPromptState(null)}
      />

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />

      <Dialog open={Boolean(importState?.open)} onOpenChange={(open) => !open && setImportState(null)}>
        <DialogContent className="w-[min(96vw,480px)] max-w-[min(96vw,480px)] sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{importState?.title ?? 'Importar snippets'}</DialogTitle>
            <DialogDescription>{importState?.description ?? 'Escolha como deseja importar os snippets.'}</DialogDescription>
          </DialogHeader>
          <div className="px-1 text-sm text-zinc-400">
            Mesclar preserva os snippets atuais. Substituir apaga toda a biblioteca atual antes da importação.
          </div>
          <div className="-mx-4 -mb-4 mt-2 flex flex-nowrap items-center justify-end gap-2 overflow-x-auto rounded-b-xl border-t bg-muted/50 p-4">
            <Button className="shrink-0 whitespace-nowrap" variant="secondary" onClick={() => setImportState(null)}>Cancelar</Button>
            <Button className="shrink-0 whitespace-nowrap" variant="secondary" onClick={() => void finishImport(false)}>Mesclar</Button>
            <Button className="shrink-0 whitespace-nowrap" variant="destructive" onClick={confirmReplaceImport}>Apagar biblioteca atual e importar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      {children}
    </div>
  );
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
      <div className="text-lg font-semibold">{title}</div>
      <p className="mt-1 text-sm text-zinc-400">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SidebarCategoryCard({
  category,
  onOpen,
  dragHandleProps,
  isSnippetDropTarget = false,
  canAcceptSnippetDrop = false,
  onSnippetDragEnter,
  onSnippetDragLeave,
  onSnippetDrop,
}: {
  category: Category;
  onOpen: () => void;
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  isSnippetDropTarget?: boolean;
  canAcceptSnippetDrop?: boolean;
  onSnippetDragEnter?: () => void;
  onSnippetDragLeave?: () => void;
  onSnippetDrop?: () => void;
}) {
  const Icon = category.icon.kind === 'emoji' ? null : getLucideIcon(category.icon.value);
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'group rounded-2xl border bg-zinc-950/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60',
        isSnippetDropTarget
          ? 'border-amber-500/70 bg-amber-500/10'
          : 'border-zinc-900 hover:border-zinc-700 hover:bg-zinc-900'
      )}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      onDragOver={
        canAcceptSnippetDrop
          ? (event) => {
            event.preventDefault();
          }
          : undefined
      }
      onDragEnter={canAcceptSnippetDrop ? onSnippetDragEnter : undefined}
      onDragLeave={canAcceptSnippetDrop ? onSnippetDragLeave : undefined}
      onDrop={
        canAcceptSnippetDrop
          ? (event) => {
            event.preventDefault();
            onSnippetDrop?.();
          }
          : undefined
      }
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-900 text-amber-400">
          {category.icon.kind === 'emoji' ? <span className="text-lg">{category.icon.value}</span> : <Icon className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{category.name}</div>
        </div>
        {dragHandleProps ? (
          <button
            type="button"
            aria-label={`Reordenar ${category.name}`}
            className="drag-handle rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
        <span className="rounded-lg p-1 text-zinc-500 transition-colors group-hover:text-zinc-200">
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function SortableSidebarCategory({
  category,
  onOpen,
  isSnippetDropTarget,
  canAcceptSnippetDrop,
  onSnippetDragEnter,
  onSnippetDragLeave,
  onSnippetDrop,
}: {
  category: Category;
  onOpen: () => void;
  isSnippetDropTarget?: boolean;
  canAcceptSnippetDrop?: boolean;
  onSnippetDragEnter?: () => void;
  onSnippetDragLeave?: () => void;
  onSnippetDrop?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'opacity-50')}>
      <SidebarCategoryCard
        category={category}
        onOpen={onOpen}
        dragHandleProps={{ ...attributes, ...listeners }}
        isSnippetDropTarget={isSnippetDropTarget}
        canAcceptSnippetDrop={canAcceptSnippetDrop}
        onSnippetDragEnter={onSnippetDragEnter}
        onSnippetDragLeave={onSnippetDragLeave}
        onSnippetDrop={onSnippetDrop}
      />
    </div>
  );
}

function CategoryDialogRow({
  category,
  onOpen,
  onSelect,
  onRename,
  onIcon,
  onDelete,
  canSelect,
  dragHandleProps,
}: {
  category: Category;
  onOpen: () => void;
  onSelect: () => void;
  onRename: () => void;
  onIcon: () => void;
  onDelete: () => void;
  canSelect: boolean;
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  const Icon = category.icon.kind === 'emoji' ? null : getLucideIcon(category.icon.value);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-950 text-amber-400">
        {category.icon.kind === 'emoji' ? <span className="text-lg">{category.icon.value}</span> : <Icon className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{category.name}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {dragHandleProps ? (
          <button
            type="button"
            aria-label={`Reordenar ${category.name}`}
            className="drag-handle rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : null}
        <Button variant="secondary" size="sm" onClick={onOpen}>Abrir</Button>
        {canSelect ? <Button variant="outline" size="sm" onClick={onSelect}>Selecionar</Button> : null}
        <Button variant="outline" size="sm" onClick={onRename}>Renomear</Button>
        <Button variant="outline" size="sm" onClick={onIcon}>Ícone</Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>Excluir</Button>
      </div>
    </div>
  );
}

function SortableCategoryDialogRow(props: React.ComponentProps<typeof CategoryDialogRow> & { category: Category }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.category.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'opacity-50')}>
      <CategoryDialogRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function PromptDialog({ state, onClose }: { state: PromptState | null; onClose: () => void }) {
  const [value, setValue] = useState(state?.defaultValue ?? '');

  useEffect(() => {
    setValue(state?.defaultValue ?? '');
  }, [state]);

  return (
    <Dialog open={Boolean(state?.open)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(92vw,520px)]">
        <DialogHeader>
          <DialogTitle>{state?.title}</DialogTitle>
          {state?.description ? <DialogDescription>{state.description}</DialogDescription> : null}
        </DialogHeader>
        <div className="px-6 py-5">
          <LabeledField label={state?.label || 'Valor'}>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
          </LabeledField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={async () => {
              if (!state) return;
              await state.onSubmit(value.trim());
              onClose();
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(state?.open)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(92vw,520px)]">
        <DialogHeader>
          <DialogTitle>{state?.title}</DialogTitle>
          <DialogDescription>{state?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant={state?.destructive ? 'destructive' : 'default'}
            onClick={async () => {
              if (!state) return;
              await state.onConfirm();
              onClose();
            }}
          >
            {state?.confirmLabel || 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MacroActionEditor({ actions, onChange }: { actions: MacroAction[]; onChange: (actions: MacroAction[]) => void }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const scriptRef = useRef(serializeMacroActions(actions));
  const [isEmpty, setIsEmpty] = useState(!scriptRef.current);

  function readEditorNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as HTMLElement;
    if (element.dataset.macroToken) {
      return element.dataset.macroToken;
    }

    if (element.tagName === 'BR') {
      return '\n';
    }

    let text = '';
    Array.from(element.childNodes).forEach((child) => {
      text += readEditorNode(child);
    });
    return text;
  }

  function readEditorScript() {
    const editor = editorRef.current;
    if (!editor) return scriptRef.current;
    return Array.from(editor.childNodes).map((node) => readEditorNode(node)).join('');
  }

  function appendTextFragment(parent: HTMLElement, value: string) {
    const lines = value.split('\n');
    lines.forEach((line, index) => {
      if (line) {
        parent.appendChild(document.createTextNode(line));
      }
      if (index < lines.length - 1) {
        parent.appendChild(document.createElement('br'));
      }
    });
  }

  function createTokenElement(rawToken: string) {
    const token = document.createElement('span');
    token.dataset.macroToken = rawToken;
    token.contentEditable = 'false';
    token.className =
      'mx-0.5 inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 align-baseline text-xs font-semibold text-amber-300 shadow-sm';
    token.textContent = getMacroTokenLabel(rawToken);
    return token;
  }

  function syncEditor(script: string) {
    const editor = editorRef.current;
    if (!editor) return;

    editor.replaceChildren();
    for (const segment of toMacroVisualSegments(script)) {
      if (segment.kind === 'text') {
        appendTextFragment(editor, segment.value);
      } else {
        editor.appendChild(createTokenElement(segment.raw));
      }
    }
    if (!editor.childNodes.length) {
      editor.appendChild(document.createElement('br'));
    }
    setIsEmpty(!script);
  }

  function applyScript(next: string) {
    scriptRef.current = next;
    setIsEmpty(!next);
    onChange(parseMacroScript(next));
  }

  function focusEditorAtEnd() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeCaretAfter(node: Node) {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    if (!node.parentNode) return;

    const trailingText = document.createTextNode('');
    node.parentNode.insertBefore(trailingText, node.nextSibling);
    range.setStart(trailingText, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function insertNodeAtSelection(node: Node) {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || !selection.rangeCount) {
      focusEditorAtEnd();
      editor?.appendChild(node);
      applyScript(readEditorScript());
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    placeCaretAfter(node);
    applyScript(readEditorScript());
  }

  function insertTextAtSelection(value: string) {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || !selection.rangeCount) {
      focusEditorAtEnd();
      document.execCommand('insertText', false, value);
      applyScript(readEditorScript());
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(value);
    range.insertNode(textNode);
    const nextRange = document.createRange();
    nextRange.setStart(textNode, textNode.textContent?.length ?? 0);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    applyScript(readEditorScript());
  }

  function insertAtCursor(token: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    insertNodeAtSelection(createTokenElement(token));
  }

  function getAdjacentTokenNode(direction: 'backward' | 'forward') {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return null;

    let node: Node | null = selection.anchorNode;
    let offset = selection.anchorOffset;

    if (node?.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (direction === 'backward' && offset > 0) return null;
      if (direction === 'forward' && offset < text.length) return null;
    }

    if (node?.nodeType === Node.ELEMENT_NODE) {
      const children = Array.from(node.childNodes);
      node = direction === 'backward' ? (children[offset - 1] ?? node) : (children[offset] ?? node);
    } else if (node) {
      node = direction === 'backward' ? node.previousSibling : node.nextSibling;
    }

    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset.macroToken) {
        return node as HTMLElement;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        return null;
      }
      node = direction === 'backward' ? node.lastChild ?? node.previousSibling : node.firstChild ?? node.nextSibling;
    }

    return null;
  }

  useEffect(() => {
    const next = serializeMacroActions(actions);
    if (next === scriptRef.current) return;
    scriptRef.current = next;
    syncEditor(next);
  }, [actions]);

  useEffect(() => {
    syncEditor(scriptRef.current);
  }, []);

  return (
    <div className="rounded-3xl border border-zinc-900 bg-zinc-950/80">
      <div className="border-b border-zinc-900 p-4">
        <div className="flex flex-wrap gap-2">
          {macroCommandButtons.map((command) => (
            <Button key={command.label} variant="secondary" size="sm" onClick={() => insertAtCursor(command.token)}>
              {command.label}
            </Button>
          ))}
          {variableTokens.map((token) => (
            <Button key={token.id} variant="outline" size="sm" onClick={() => insertAtCursor(token.id)}>
              {token.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div
          className={cn(
            'min-h-[280px] rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm outline-none transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
            isEmpty && 'text-zinc-500'
          )}
        >
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Digite o texto do snippet aqui. Use os botões acima para inserir comandos e variáveis."
            className="min-h-[260px] whitespace-pre-wrap break-words outline-none empty:before:pointer-events-none empty:before:text-zinc-500 empty:before:content-[attr(data-placeholder)]"
            onInput={() => applyScript(readEditorScript())}
            onPaste={(event) => {
              event.preventDefault();
              insertTextAtSelection(event.clipboardData.getData('text/plain'));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                insertTextAtSelection('\n');
                return;
              }

              if (event.key === 'Backspace' || event.key === 'Delete') {
                const tokenNode = getAdjacentTokenNode(event.key === 'Backspace' ? 'backward' : 'forward');
                if (tokenNode) {
                  event.preventDefault();
                  tokenNode.remove();
                  applyScript(readEditorScript());
                }
              }
            }}
          />
        </div>
        <div className="text-sm text-zinc-500">
          Os comandos aparecem como chips inline e são removidos como uma unidade com <span className="font-mono text-zinc-300">Backspace</span> ou <span className="font-mono text-zinc-300">Delete</span>.
        </div>
        <div className="text-xs text-zinc-600">
          O conteúdo continua sendo salvo no formato interno de ações da macro; esta tela só simplifica a edição.
        </div>
      </div>
    </div>
  );
}
