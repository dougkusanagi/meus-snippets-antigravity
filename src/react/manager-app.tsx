import { invoke } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update as AppUpdate } from '@tauri-apps/plugin-updater';
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
  ArrowUpDown,
  ChevronDown,
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
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

type CategoryDraftState = {
  mode: 'create-root' | 'create-child' | 'edit';
  id?: string;
  name: string;
  parentId: string | null;
  icon: CategoryIcon;
};

type CategoryTreeNode = {
  category: Category;
  children: CategoryTreeNode[];
};

type SidebarSelection =
  | { type: 'root' }
  | { type: 'uncategorized' }
  | { type: 'category'; categoryId: string };

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
    trigger: normalizeSnippetTriggerInput(snippet.trigger),
    name: snippet.name,
    categoryId: snippet.categoryId,
    tags: snippet.tags.join(', '),
    favorite: snippet.favorite,
    actions: snippet.actions.length ? snippet.actions : [{ type: 'text', value: '' }],
  };
}

function normalizeSnippetTriggerInput(value: string) {
  return value.trim().replace(/^\/+/, '');
}

function formatSnippetTrigger(trigger: string) {
  const normalized = normalizeSnippetTriggerInput(trigger);
  return normalized ? `/${normalized}` : '/';
}

function buildCategoryTree(categories: Category[]) {
  const byParent = new Map<string | null, Category[]>();
  const byId = new Map(categories.map((category) => [category.id, category]));
  for (const category of categories) {
    const parentId = category.parentId ?? null;
    const siblings = byParent.get(parentId) ?? [];
    siblings.push(category);
    byParent.set(parentId, siblings);
  }

  const sortCategories = (items: Category[], parentId: string | null) =>
    [...items].sort((a, b) => {
      const sortMode =
        parentId === null
          ? items[0]?.sortMode ?? 'manual'
          : byId.get(parentId)?.sortMode ?? 'manual';
      if (sortMode === 'alphabetical') {
        return a.name.localeCompare(b.name, 'pt-BR');
      }
      if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

  const buildNodes = (parentId: string | null): CategoryTreeNode[] =>
    sortCategories(byParent.get(parentId) ?? [], parentId).map((category) => ({
      category,
      children: buildNodes(category.id),
    }));

  return buildNodes(null);
}

function getAncestorIds(categoryId: string | null, categories: Category[]) {
  if (!categoryId) return [] as string[];
  const byId = new Map(categories.map((category) => [category.id, category]));
  const ids: string[] = [];
  let cursor = byId.get(categoryId) ?? null;

  while (cursor?.parentId) {
    ids.unshift(cursor.parentId);
    cursor = byId.get(cursor.parentId) ?? null;
  }

  return ids;
}

function getDescendantIds(categoryId: string, categories: Category[]) {
  const byParent = new Map<string | null, string[]>();
  for (const category of categories) {
    const parentId = category.parentId ?? null;
    const children = byParent.get(parentId) ?? [];
    children.push(category.id);
    byParent.set(parentId, children);
  }

  const descendants: string[] = [];
  const stack = [...(byParent.get(categoryId) ?? [])];
  while (stack.length) {
    const current = stack.pop()!;
    descendants.push(current);
    stack.push(...(byParent.get(current) ?? []));
  }
  return descendants;
}

function getSiblingCategories(parentId: string | null, categories: Category[]) {
  return categories
    .filter((category) => (category.parentId ?? null) === parentId)
    .sort((a, b) => {
      if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
}

function formatShortcutForDisplay(shortcut: string, isMac: boolean) {
  return String(shortcut || '')
    .replace(/CommandOrControl/gi, isMac ? 'Cmd' : 'Ctrl')
    .replace(/Command/gi, 'Cmd')
    .replace(/Meta/gi, isMac ? 'Cmd' : 'Win')
    .replace(/Super/gi, isMac ? 'Cmd' : 'Win');
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
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
  const [sidebarSelection, setSidebarSelection] = useState<SidebarSelection>({ type: 'root' });
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const [expandedSidebarItemIds, setExpandedSidebarItemIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<SnippetDraft>(emptyDraft());
  const [draggedSnippetId, setDraggedSnippetId] = useState<string | null>(null);
  const [snippetDropCategoryId, setSnippetDropCategoryId] = useState<string | null>(null);
  const [shortcutDisplay, setShortcutDisplay] = useState('Carregando...');
  const [recordingShortcut, setRecordingShortcut] = useState(false);
  const [updateStatus, setUpdateStatus] = useState({
    title: 'Verificando atualizações...',
    description: 'Comparando a versão instalada com a release mais recente.',
    latestUrl: 'https://github.com/dougkusanagi/meus-snippets-antigravity/releases',
    actionLabel: 'Verificar agora',
    canRunAction: true,
    isDownloading: false,
    progressPercent: 0,
  });
  const [permissionInfo, setPermissionInfo] = useState<{
    title: string;
    description: string;
    visible: boolean;
  }>({ title: '', description: '', visible: false });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [categoryPickerExpandedIds, setCategoryPickerExpandedIds] = useState<Set<string>>(new Set());
  const [categoryManagerExpandedIds, setCategoryManagerExpandedIds] = useState<Set<string>>(new Set());
  const [categoryManagerSelectedId, setCategoryManagerSelectedId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraftState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [iconState, setIconState] = useState<IconState | null>(null);
  const [iconTab, setIconTab] = useState<'lucide' | 'emoji'>('lucide');
  const [iconSearch, setIconSearch] = useState('');
  const [emojiValue, setEmojiValue] = useState('📁');
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [conflictText, setConflictText] = useState('');
  const shortcutRef = useRef<HTMLButtonElement | null>(null);
  const pendingUpdateRef = useRef<AppUpdate | null>(null);

  const selectedSnippet = useMemo(
    () => snippets.find((snippet) => snippet.id === selectedSnippetId) ?? null,
    [selectedSnippetId, snippets]
  );

  const sortSnippets = (items: Snippet[]) =>
    [...items].sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      if (sortOrder === 'used') return (b.usageCount || 0) - (a.usageCount || 0);
      if (sortOrder === 'name') return a.name.localeCompare(b.name, 'pt-BR');
      return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
    });

  const filteredLucideIcons = useMemo(
    () => lucideIconOptions.filter(([name]) => name.toLowerCase().includes(iconSearch.toLowerCase())),
    [iconSearch]
  );

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const snippetsByCategoryId = useMemo(() => {
    const grouped = new Map<string, Snippet[]>();
    for (const snippet of snippets) {
      if (!snippet.categoryId) continue;
      const current = grouped.get(snippet.categoryId) ?? [];
      current.push(snippet);
      grouped.set(snippet.categoryId, current);
    }

    for (const [categoryId, items] of grouped.entries()) {
      grouped.set(categoryId, sortSnippets(items));
    }

    return grouped;
  }, [snippets, sortOrder]);

  const rootSnippets = useMemo(
    () => sortSnippets(snippets.filter((snippet) => !snippet.categoryId)),
    [snippets, sortOrder]
  );

  const categorySnippetCounts = useMemo(() => {
    const byParent = new Map<string | null, string[]>();
    for (const category of categories) {
      const parentKey = category.parentId ?? null;
      const current = byParent.get(parentKey) ?? [];
      current.push(category.id);
      byParent.set(parentKey, current);
    }

    const directCounts = new Map<string, number>();
    for (const snippet of snippets) {
      if (!snippet.categoryId) continue;
      directCounts.set(snippet.categoryId, (directCounts.get(snippet.categoryId) ?? 0) + 1);
    }

    const totals = new Map<string, number>();
    const countAll = (categoryId: string): number => {
      if (totals.has(categoryId)) return totals.get(categoryId)!;
      const nested = (byParent.get(categoryId) ?? []).reduce((sum, childId) => sum + countAll(childId), 0);
      const total = (directCounts.get(categoryId) ?? 0) + nested;
      totals.set(categoryId, total);
      return total;
    };

    for (const category of categories) {
      countAll(category.id);
    }

    return totals;
  }, [categories, snippets]);

  const canDragSnippetsToCategory = !search.trim();

  const normalizedSearch = search.trim().toLowerCase();
  const normalizedTriggerSearch = normalizeSnippetTriggerInput(normalizedSearch).toLowerCase();

  const matchesSnippetSearch = (snippet: Snippet) =>
    snippet.trigger.toLowerCase().includes(normalizedSearch) ||
    snippet.trigger.toLowerCase().includes(normalizedTriggerSearch) ||
    snippet.name.toLowerCase().includes(normalizedSearch) ||
    snippet.categoryPath.toLowerCase().includes(normalizedSearch) ||
    snippet.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));

  const filteredCategoryTree = useMemo(() => {
    if (!normalizedSearch) return categoryTree;

    const filterNodes = (nodes: CategoryTreeNode[]): CategoryTreeNode[] =>
      nodes
        .map((node) => {
          const childMatches = filterNodes(node.children);
          const snippetsInCategory = snippetsByCategoryId.get(node.category.id) ?? [];
          const hasSnippetMatch = snippetsInCategory.some(matchesSnippetSearch);
          const categoryMatches = node.category.name.toLowerCase().includes(normalizedSearch);

          if (!categoryMatches && !hasSnippetMatch && !childMatches.length) return null;
          return { ...node, children: childMatches };
        })
        .filter(Boolean) as CategoryTreeNode[];

    return filterNodes(categoryTree);
  }, [categoryTree, normalizedSearch, snippetsByCategoryId]);

  const filteredRootSnippets = useMemo(
    () => (normalizedSearch ? rootSnippets.filter(matchesSnippetSearch) : rootSnippets),
    [normalizedSearch, rootSnippets]
  );

  const displayedSnippetsByCategoryId = useMemo(() => {
    if (!normalizedSearch) return snippetsByCategoryId;

    const filtered = new Map<string, Snippet[]>();
    for (const [categoryId, items] of snippetsByCategoryId.entries()) {
      const nextItems = items.filter(matchesSnippetSearch);
      if (nextItems.length) filtered.set(categoryId, nextItems);
    }
    return filtered;
  }, [normalizedSearch, snippetsByCategoryId]);

  const autoExpandedSidebarItemIds = useMemo(() => {
    const ids = new Set<string>();

    if (normalizedSearch) {
      const walk = (nodes: CategoryTreeNode[]) => {
        for (const node of nodes) {
          ids.add(node.category.id);
          walk(node.children);
        }
      };
      walk(filteredCategoryTree);
      if (filteredRootSnippets.length) ids.add('__uncategorized__');
    }

    if (selectedSnippet?.categoryId) {
      ids.add(selectedSnippet.categoryId);
      for (const ancestorId of getAncestorIds(selectedSnippet.categoryId, categories)) {
        ids.add(ancestorId);
      }
    } else if (selectedSnippet && !selectedSnippet.categoryId) {
      ids.add('__uncategorized__');
    }

    return Array.from(ids);
  }, [categories, filteredCategoryTree, filteredRootSnippets.length, normalizedSearch, selectedSnippet]);

  const effectiveExpandedSidebarItemIds = useMemo(
    () => Array.from(new Set([...expandedSidebarItemIds, ...autoExpandedSidebarItemIds])),
    [autoExpandedSidebarItemIds, expandedSidebarItemIds]
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

  function getSortModeForParent(parentId: string | null) {
    if (parentId === null) {
      return categories.find((category) => category.parentId === null)?.sortMode ?? 'manual';
    }
    return getCategoryById(parentId)?.sortMode ?? 'manual';
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
      actionLabel: 'Verificando...',
      canRunAction: false,
      isDownloading: false,
      progressPercent: 0,
    }));
    try {
      const update = await check();
      pendingUpdateRef.current = update;

      if (!update) {
        const currentVersion = await coreInvoke<string>('get_app_version');
        setUpdateStatus({
          title: 'Você já está na versão mais recente',
          description: `Versão instalada ${currentVersion}. Nenhuma atualização nova encontrada agora.`,
          latestUrl: 'https://github.com/dougkusanagi/meus-snippets-antigravity/releases',
          actionLabel: 'Verificar agora',
          canRunAction: true,
          isDownloading: false,
          progressPercent: 0,
        });
        return;
      }

      setUpdateStatus({
        title: 'Nova atualização disponível',
        description: `Versão atual ${update.currentVersion}. Nova versão ${update.version} pronta para download em segundo plano.`,
        latestUrl: 'https://github.com/dougkusanagi/meus-snippets-antigravity/releases',
        actionLabel: 'Baixar atualização',
        canRunAction: true,
        isDownloading: false,
        progressPercent: 0,
      });
    } catch (error) {
      console.error(error);
      pendingUpdateRef.current = null;
      setUpdateStatus({
        title: 'Não foi possível verificar atualizações',
        description: 'Falha ao consultar ou validar a release mais recente. Você pode abrir a página de releases manualmente.',
        latestUrl: 'https://github.com/dougkusanagi/meus-snippets-antigravity/releases',
        actionLabel: 'Abrir releases',
        canRunAction: true,
        isDownloading: false,
        progressPercent: 0,
      });
      if (!silent) toast.error('Não foi possível verificar atualizações.');
    }
  }

  async function downloadAvailableUpdate() {
    const update = pendingUpdateRef.current;
    if (!update) {
      await checkForUpdates(false);
      return;
    }

    let downloadedBytes = 0;
    let totalBytes = 0;

    setUpdateStatus((state) => ({
      ...state,
      title: 'Baixando atualização...',
      description: `Preparando download da versão ${update.version} em segundo plano.`,
      actionLabel: 'Baixando...',
      canRunAction: false,
      isDownloading: true,
      progressPercent: 0,
    }));

    try {
      await update.download((event) => {
        if (event.event === 'Started') {
          totalBytes = event.data.contentLength ?? 0;
          downloadedBytes = 0;
          setUpdateStatus((state) => ({
            ...state,
            description: totalBytes > 0
              ? `Baixando a versão ${update.version} em segundo plano.`
              : `Baixando a versão ${update.version}. O tamanho total não foi informado pela release.`,
          }));
          return;
        }

        if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength;
          const progressPercent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
          setUpdateStatus((state) => ({
            ...state,
            description: totalBytes > 0
              ? `Download em andamento: ${progressPercent}% (${formatBytes(downloadedBytes)} de ${formatBytes(totalBytes)}).`
              : `Download em andamento: ${formatBytes(downloadedBytes)} recebidos.`,
            progressPercent,
          }));
          return;
        }

        setUpdateStatus((state) => ({
          ...state,
          progressPercent: 100,
        }));
      });

      setUpdateStatus({
        title: 'Atualização pronta para instalar',
        description: `A versão ${update.version} foi baixada. Você pode fechar o app agora para instalar e reabrir automaticamente na nova versão.`,
        latestUrl: 'https://github.com/dougkusanagi/meus-snippets-antigravity/releases',
        actionLabel: 'Atualizar agora',
        canRunAction: true,
        isDownloading: false,
        progressPercent: 100,
      });

      setConfirmState({
        open: true,
        title: 'Instalar atualização agora?',
        description: `O app será fechado, a versão ${update.version} será instalada e a aplicação será reaberta automaticamente.`,
        confirmLabel: 'Atualizar agora',
        onConfirm: async () => {
          await installDownloadedUpdate();
        },
      });
    } catch (error) {
      console.error(error);
      setUpdateStatus({
        title: 'Falha ao baixar atualização',
        description: 'Não foi possível concluir o download da nova versão. Você pode tentar novamente ou abrir a página de releases.',
        latestUrl: 'https://github.com/dougkusanagi/meus-snippets-antigravity/releases',
        actionLabel: 'Abrir releases',
        canRunAction: true,
        isDownloading: false,
        progressPercent: 0,
      });
      toast.error('Falha ao baixar a atualização.');
    }
  }

  async function installDownloadedUpdate() {
    const update = pendingUpdateRef.current;
    if (!update) return;

    setUpdateStatus((state) => ({
      ...state,
      title: 'Instalando atualização...',
      description: `Fechando o app para instalar a versão ${update.version}.`,
      actionLabel: 'Instalando...',
      canRunAction: false,
      isDownloading: false,
    }));

    try {
      await update.install();
      await relaunch();
    } catch (error) {
      console.error(error);
      setUpdateStatus({
        title: 'Falha ao instalar atualização',
        description: 'O download foi concluído, mas a instalação automática falhou. Abra a página de releases para instalar manualmente.',
        latestUrl: 'https://github.com/dougkusanagi/meus-snippets-antigravity/releases',
        actionLabel: 'Abrir releases',
        canRunAction: true,
        isDownloading: false,
        progressPercent: 100,
      });
      toast.error('Falha ao instalar a atualização.');
    }
  }

  async function handleUpdateAction() {
    if (!updateStatus.canRunAction) return;

    if (updateStatus.actionLabel === 'Baixar atualização') {
      await downloadAvailableUpdate();
      return;
    }

    if (updateStatus.actionLabel === 'Atualizar agora') {
      setConfirmState({
        open: true,
        title: 'Instalar atualização agora?',
        description: 'O app será fechado para concluir a instalação e será reaberto automaticamente.',
        confirmLabel: 'Atualizar agora',
        onConfirm: async () => {
          await installDownloadedUpdate();
        },
      });
      return;
    }

    if (updateStatus.actionLabel === 'Abrir releases') {
      await coreInvoke('open_external_url', { url: updateStatus.latestUrl });
      return;
    }

    await checkForUpdates(false);
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

  useEffect(() => {
    if (!categoryManagerSelectedId) return;
    const selected = getCategoryById(categoryManagerSelectedId);
    if (!selected) {
      setCategoryManagerSelectedId(null);
      if (categoryDraft?.id === categoryManagerSelectedId) {
        setCategoryDraft(null);
      }
      return;
    }

    if (categoryDraft?.mode === 'edit' && categoryDraft.id === selected.id) {
      setCategoryDraft((current) =>
        current
          ? {
              ...current,
              name: selected.name,
              parentId: selected.parentId,
              icon: selected.icon,
            }
          : current
      );
    }
  }, [categories]);

  function openNewSnippet() {
    setSelectedSnippetId(null);
    setDraft(emptyDraft());
    setPanel('editor');
  }

  function openSnippet(snippet: Snippet) {
    if (snippet.categoryId) {
      setCurrentCategoryId(snippet.categoryId);
      setSidebarSelection({ type: 'category', categoryId: snippet.categoryId });
      setExpandedSidebarItemIds((current) =>
        Array.from(new Set([...current, snippet.categoryId, ...getAncestorIds(snippet.categoryId, categories)]))
      );
    } else {
      setCurrentCategoryId(null);
      setSidebarSelection({ type: 'uncategorized' });
      setExpandedSidebarItemIds((current) => Array.from(new Set([...current, '__uncategorized__'])));
    }
    setSelectedSnippetId(snippet.id);
    setDraft(toDraft(snippet));
    setPanel('editor');
  }

  async function saveSnippet() {
    const normalizedTrigger = normalizeSnippetTriggerInput(draft.trigger);
    if (!normalizedTrigger) {
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
      trigger: normalizedTrigger,
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

  function openCategoryPicker() {
    setCategoryPickerExpandedIds(new Set(getAncestorIds(draft.categoryId, categories)));
    setCategoryPickerOpen(true);
  }

  function openCategoryManager(targetId?: string | null) {
    const nextSelectedId = targetId ?? currentCategoryId ?? draft.categoryId ?? categories.find((category) => category.parentId === null)?.id ?? null;
    setCategoryManagerSelectedId(nextSelectedId);
    setCategoryManagerExpandedIds(new Set(getAncestorIds(nextSelectedId, categories)));
    setCategoryDraft(
      nextSelectedId
        ? (() => {
            const selected = getCategoryById(nextSelectedId);
            return selected
              ? {
                  mode: 'edit' as const,
                  id: selected.id,
                  name: selected.name,
                  parentId: selected.parentId,
                  icon: selected.icon,
                }
              : null;
          })()
        : null
    );
    setCategoryManagerOpen(true);
  }

  function startCategoryDraft(mode: CategoryDraftState['mode'], target?: Category | null) {
    if (mode === 'edit' && target) {
      setCategoryManagerSelectedId(target.id);
      setCategoryManagerExpandedIds((current) => new Set([...current, ...getAncestorIds(target.id, categories)]));
      setCategoryDraft({
        mode,
        id: target.id,
        name: target.name,
        parentId: target.parentId,
        icon: target.icon,
      });
      return;
    }

    const parentId = mode === 'create-child' ? target?.id ?? categoryManagerSelectedId ?? null : null;
    if (parentId) {
      setCategoryManagerExpandedIds((current) => new Set([...current, parentId]));
    }
    setCategoryDraft({
      mode,
      name: '',
      parentId,
      icon: { kind: 'lucide', value: 'folder' },
    });
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

  async function handleCategoryManagerDrop(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeCategory = getCategoryById(String(active.id));
    const overCategory = getCategoryById(String(over.id));
    if (!activeCategory || !overCategory) return;

    const parentId = activeCategory.parentId ?? null;
    if ((overCategory.parentId ?? null) !== parentId) return;

    const ids = getSiblingCategories(parentId, categories).map((category) => category.id);
    const oldIndex = ids.indexOf(activeCategory.id);
    const newIndex = ids.indexOf(overCategory.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    try {
      await coreInvoke('reorder_categories', { parentId, orderedIds: next });
      await loadSnapshot(selectedSnippetId);
    } catch (error) {
      toast.error(`Erro ao reordenar categorias: ${String(error)}`);
    }
  }

  async function setSortMode(nextMode: 'manual' | 'alphabetical', parentId: string | null = currentCategoryId) {
    try {
      await coreInvoke('set_category_sort_mode', { parentId, sortMode: nextMode });
      await loadSnapshot(selectedSnippetId);
    } catch (error) {
      toast.error(`Erro ao alterar ordenação: ${String(error)}`);
    }
  }

  async function saveCategoryDraft() {
    if (!categoryDraft) return;
    try {
      if (categoryDraft.mode === 'edit' && categoryDraft.id) {
        await coreInvoke('update_category', {
          id: categoryDraft.id,
          name: categoryDraft.name.trim(),
          parentId: categoryDraft.parentId,
          icon: categoryDraft.icon,
        });
        toast.success('Categoria atualizada.');
      } else {
        const created = await coreInvoke<Category>('create_category', {
          name: categoryDraft.name.trim(),
          parentId: categoryDraft.parentId,
          icon: categoryDraft.icon,
        });
        setCategoryManagerSelectedId(created.id);
        setCategoryManagerExpandedIds((current) => new Set([...current, ...getAncestorIds(created.id, [...categories, created])]));
        setCategoryDraft({
          mode: 'edit',
          id: created.id,
          name: created.name,
          parentId: created.parentId,
          icon: created.icon,
        });
        toast.success('Categoria criada.');
        await loadSnapshot(selectedSnippetId);
        return;
      }
      const nextId = categoryDraft.id ?? categoryManagerSelectedId;
      if (nextId) {
        setCategoryManagerExpandedIds((current) => new Set([...current, ...getAncestorIds(nextId, categories)]));
      }
      await loadSnapshot(selectedSnippetId);
    } catch (error) {
      toast.error(`Erro ao salvar categoria: ${String(error)}`);
    }
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
        if (categoryManagerSelectedId === category.id) {
          setCategoryManagerSelectedId(category.parentId ?? null);
          setCategoryDraft(null);
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
    <div className="flex h-full min-h-0 overflow-hidden bg-transparent text-zinc-100">
      <CategoryExplorerSidebar
        logo={logo}
        search={search}
        onSearchChange={setSearch}
        sortOrder={sortOrder}
        onSortOrderChange={(value) => setSortOrder(value)}
        sidebarSelection={sidebarSelection}
        currentCategoryId={currentCategoryId}
        currentCategoryPath={
          sidebarSelection.type === 'uncategorized'
            ? 'Sem categoria'
            : sidebarSelection.type === 'category'
              ? getCategoryPath(sidebarSelection.categoryId)
              : 'Biblioteca'
        }
        categories={filteredCategoryTree}
        categoryCounts={categorySnippetCounts}
        rootSnippets={filteredRootSnippets}
        snippetsByCategoryId={displayedSnippetsByCategoryId}
        selectedSnippetId={selectedSnippetId}
        expandedItemIds={effectiveExpandedSidebarItemIds}
        onExpandedItemIdsChange={setExpandedSidebarItemIds}
        onSelectRoot={() => {
          setCurrentCategoryId(null);
          setSidebarSelection({ type: 'root' });
        }}
        onOpenCategory={(categoryId) => {
          setCurrentCategoryId(categoryId);
          setSidebarSelection({ type: 'category', categoryId });
        }}
        onOpenSnippet={openSnippet}
        onOpenUncategorized={() => {
          setCurrentCategoryId(null);
          setSidebarSelection({ type: 'uncategorized' });
        }}
        onSnippetDragStart={(snippetId) => setDraggedSnippetId(snippetId)}
        onSnippetDragEnd={() => {
          setDraggedSnippetId(null);
          setSnippetDropCategoryId(null);
        }}
        onNewSnippet={openNewSnippet}
        onManageCategories={() => openCategoryManager(currentCategoryId)}
        onOpenSettings={() => {
          setPanel('settings');
          void loadSettings();
        }}
        snippetDropCategoryId={snippetDropCategoryId}
        canAcceptSnippetDrop={canDragSnippetsToCategory}
        onSnippetDragEnter={setSnippetDropCategoryId}
        onSnippetDragLeave={(categoryId) => {
          setSnippetDropCategoryId((current) => (current === categoryId ? null : current));
        }}
        onSnippetDrop={(categoryId) => void (draggedSnippetId ? moveSnippetToCategory(draggedSnippetId, categoryId) : Promise.resolve())}
      />

      <main className="flex-1 min-h-0 overflow-hidden bg-[#0b0d14]">
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

        <div className="h-full min-h-0">
          <div className="h-full min-h-0">
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
                        {updateStatus.isDownloading || updateStatus.progressPercent > 0 ? (
                          <div className="mt-4">
                            <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                              <div
                                className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
                                style={{ width: `${updateStatus.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button variant={updateStatus.actionLabel === 'Atualizar agora' ? 'default' : 'secondary'} disabled={!updateStatus.canRunAction} onClick={() => void handleUpdateAction()}>
                            {updateStatus.actionLabel === 'Baixar atualização' || updateStatus.actionLabel === 'Abrir releases' ? <Download className="h-4 w-4" /> : null}
                            {updateStatus.actionLabel === 'Verificar agora' || updateStatus.actionLabel === 'Verificando...' ? <RefreshCw className="h-4 w-4" /> : null}
                            {updateStatus.actionLabel}
                          </Button>
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
            ) : panel === 'editor' ? (
              <SnippetEditorPane
                draft={draft}
                categoryLabel={draft.categoryId ? getCategoryPath(draft.categoryId) : 'Sem categoria'}
                onChangeDraft={setDraft}
                onToggleFavorite={() => void toggleFavorite()}
                onDuplicate={() => void duplicateSnippet()}
                onPreview={() => setPreviewOpen(true)}
                onDelete={() => void deleteSnippet()}
                onSave={() => void saveSnippet()}
                onOpenCategoryPicker={openCategoryPicker}
                onClearCategory={() => setDraft((state) => ({ ...state, categoryId: null }))}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-zinc-400">
                <Keyboard className="h-12 w-12 opacity-40" />
                <div className="text-2xl font-bold text-white">Selecione ou crie um snippet</div>
                <p className="max-w-lg text-sm">Abra um snippet direto pela sidebar ou clique em “Novo Snippet” para criar um.</p>
              </div>
            )}
          </div>
        </div>
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

      <CategoryPickerDialog
        open={categoryPickerOpen}
        categories={categoryTree}
        expandedIds={categoryPickerExpandedIds}
        selectedCategoryId={draft.categoryId}
        onOpenChange={setCategoryPickerOpen}
        onToggleExpanded={(categoryId) =>
          setCategoryPickerExpandedIds((current) => {
            const next = new Set(current);
            if (next.has(categoryId)) next.delete(categoryId);
            else next.add(categoryId);
            return next;
          })
        }
        onSelectCategory={(categoryId) => {
          setDraft((state) => ({ ...state, categoryId }));
          setCategoryPickerOpen(false);
        }}
        onClearCategory={() => {
          setDraft((state) => ({ ...state, categoryId: null }));
          setCategoryPickerOpen(false);
        }}
        onOpenManager={() => {
          setCategoryPickerOpen(false);
          openCategoryManager(draft.categoryId);
        }}
      />

      <CategoryManagerDialog
        open={categoryManagerOpen}
        categories={categories}
        tree={categoryTree}
        expandedIds={categoryManagerExpandedIds}
        selectedCategoryId={categoryManagerSelectedId}
        categoryDraft={categoryDraft}
        categoryCounts={categorySnippetCounts}
        sensors={sensors}
        getCategoryPath={getCategoryPath}
        getSortModeForParent={getSortModeForParent}
        onOpenChange={setCategoryManagerOpen}
        onToggleExpanded={(categoryId) =>
          setCategoryManagerExpandedIds((current) => {
            const next = new Set(current);
            if (next.has(categoryId)) next.delete(categoryId);
            else next.add(categoryId);
            return next;
          })
        }
        onSelectCategory={(categoryId) => {
          const selected = getCategoryById(categoryId);
          setCategoryManagerSelectedId(categoryId);
          setCategoryManagerExpandedIds((current) => new Set([...current, ...getAncestorIds(categoryId, categories)]));
          if (selected) {
            setCategoryDraft({
              mode: 'edit',
              id: selected.id,
              name: selected.name,
              parentId: selected.parentId,
              icon: selected.icon,
            });
          }
        }}
        onCreateRoot={() => startCategoryDraft('create-root')}
        onCreateChild={() => startCategoryDraft('create-child', getCategoryById(categoryManagerSelectedId))}
        onDeleteSelected={() => {
          const selected = getCategoryById(categoryManagerSelectedId);
          if (selected) openDeleteCategory(selected);
        }}
        onSaveDraft={() => void saveCategoryDraft()}
        onChangeDraft={setCategoryDraft}
        onChooseIcon={chooseIcon}
        onReorder={(event) => void handleCategoryManagerDrop(event)}
        onSetSortMode={(sortMode, parentId) => void setSortMode(sortMode, parentId)}
      />

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

function CategoryExplorerSidebar({
  logo,
  search,
  onSearchChange,
  sortOrder,
  onSortOrderChange,
  sidebarSelection,
  currentCategoryId,
  currentCategoryPath,
  categories,
  categoryCounts,
  rootSnippets,
  snippetsByCategoryId,
  selectedSnippetId,
  expandedItemIds,
  onExpandedItemIdsChange,
  onSelectRoot,
  onOpenCategory,
  onOpenSnippet,
  onOpenUncategorized,
  onSnippetDragStart,
  onSnippetDragEnd,
  onNewSnippet,
  onManageCategories,
  onOpenSettings,
  snippetDropCategoryId,
  canAcceptSnippetDrop,
  onSnippetDragEnter,
  onSnippetDragLeave,
  onSnippetDrop,
}: {
  logo: string;
  search: string;
  onSearchChange: (value: string) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (value: SortOrder) => void;
  sidebarSelection: SidebarSelection;
  currentCategoryId: string | null;
  currentCategoryPath: string;
  categories: CategoryTreeNode[];
  categoryCounts: Map<string, number>;
  rootSnippets: Snippet[];
  snippetsByCategoryId: Map<string, Snippet[]>;
  selectedSnippetId: string | null;
  expandedItemIds: string[];
  onExpandedItemIdsChange: React.Dispatch<React.SetStateAction<string[]>>;
  onSelectRoot: () => void;
  onOpenCategory: (categoryId: string) => void;
  onOpenSnippet: (snippet: Snippet) => void;
  onOpenUncategorized: () => void;
  onSnippetDragStart: (snippetId: string) => void;
  onSnippetDragEnd: () => void;
  onNewSnippet: () => void;
  onManageCategories: () => void;
  onOpenSettings: () => void;
  snippetDropCategoryId: string | null;
  canAcceptSnippetDrop: boolean;
  onSnippetDragEnter: (categoryId: string) => void;
  onSnippetDragLeave: (categoryId: string) => void;
  onSnippetDrop: (categoryId: string) => void;
}) {
  return (
    <aside className="flex h-full min-h-0 w-[340px] min-w-[340px] flex-col border-r border-zinc-900 bg-zinc-950/85 backdrop-blur-xl">
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
            <Input className="pl-10" placeholder="Buscar snippets..." value={search} onChange={(e) => onSearchChange(e.target.value)} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Ordenar snippets">
                <ArrowUpDown className="h-4 w-4 text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Ordenar snippets</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sortOrder} onValueChange={(value) => onSortOrderChange(value as SortOrder)}>
                <DropdownMenuRadioItem value="recent">Mais recentes</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="used">Mais usados</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name">Nome</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border-b border-zinc-900 px-4 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Biblioteca"
            onClick={onSelectRoot}
          >
            <House className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Biblioteca</div>
            <div className="truncate text-sm font-semibold">{currentCategoryPath || 'Biblioteca'}</div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-3">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Explorador</div>
            <div className="mt-1 text-sm text-zinc-400">
              {categories.length || rootSnippets.length
                ? 'Expanda categorias e abra snippets direto pela sidebar.'
                : 'Crie categorias e snippets para começar a organizar a biblioteca.'}
            </div>
          </div>

          <Accordion
            type="multiple"
            value={expandedItemIds}
            onValueChange={onExpandedItemIdsChange}
            className="space-y-2"
          >
            <AccordionItem value="__uncategorized__">
              <div
                className={cn(
                  'rounded-2xl border border-zinc-900 bg-zinc-950/80',
                  sidebarSelection.type === 'uncategorized' && 'border-amber-500/60 bg-amber-500/10'
                )}
              >
                <AccordionTrigger className="px-3 py-3 hover:no-underline" onClick={onOpenUncategorized}>
                  <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-900 text-amber-400">
                      <Archive className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">Sem categoria</span>
                      <span className="block text-xs text-zinc-500">
                        {rootSnippets.length === 1 ? '1 snippet' : `${rootSnippets.length} snippets`}
                      </span>
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  {rootSnippets.length ? (
                    <div className="space-y-2 pl-4">
                      {rootSnippets.map((snippet) => (
                        <SidebarSnippetButton
                          key={snippet.id}
                          snippet={snippet}
                          selectedSnippetId={selectedSnippetId}
                          canDragSnippets={canAcceptSnippetDrop}
                          onOpenSnippet={onOpenSnippet}
                          onSnippetDragStart={() => onSnippetDragStart(snippet.id)}
                          onSnippetDragEnd={onSnippetDragEnd}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="pl-4 text-sm text-zinc-500">Nenhum snippet sem categoria.</div>
                  )}
                </AccordionContent>
              </div>
            </AccordionItem>

            <SidebarCategoryNodeList
              nodes={categories}
              level={0}
              currentCategoryId={currentCategoryId}
              categoryCounts={categoryCounts}
              snippetsByCategoryId={snippetsByCategoryId}
              selectedSnippetId={selectedSnippetId}
              canAcceptSnippetDrop={canAcceptSnippetDrop}
              snippetDropCategoryId={snippetDropCategoryId}
              onOpenCategory={onOpenCategory}
              onOpenSnippet={onOpenSnippet}
              onSnippetDragStart={onSnippetDragStart}
              onSnippetDragEnd={onSnippetDragEnd}
              onSnippetDragEnter={onSnippetDragEnter}
              onSnippetDragLeave={onSnippetDragLeave}
              onSnippetDrop={onSnippetDrop}
            />
          </Accordion>

          {!categories.length && !rootSnippets.length ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/80 px-4 py-8 text-center text-sm text-zinc-500">
              <ClipboardList className="mx-auto mb-3 h-8 w-8 opacity-50" />
              Nenhum snippet ou categoria encontrado.
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <div className="border-t border-zinc-900 bg-black/20 p-3">
        <div className="flex items-center gap-2">
          <Button className="flex-1" onClick={onNewSnippet}>
            <Zap className="h-4 w-4" />
            Novo Snippet
          </Button>
          <Button variant="secondary" size="icon" onClick={onManageCategories}>
            <FolderCog className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

function SidebarSnippetButton({
  snippet,
  selectedSnippetId,
  onOpenSnippet,
  canDragSnippets,
  onSnippetDragStart,
  onSnippetDragEnd,
}: {
  snippet: Snippet;
  selectedSnippetId: string | null;
  onOpenSnippet: (snippet: Snippet) => void;
  canDragSnippets: boolean;
  onSnippetDragStart: (() => void) | undefined;
  onSnippetDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenSnippet(snippet)}
      draggable={canDragSnippets}
      onDragStart={onSnippetDragStart}
      onDragEnd={onSnippetDragEnd}
      className={cn(
        'block w-full rounded-2xl border px-4 py-3 text-left transition-colors',
        selectedSnippetId === snippet.id
          ? 'border-amber-500/70 bg-amber-500/10'
          : 'border-zinc-900 bg-zinc-950/80 hover:border-zinc-700 hover:bg-zinc-900',
        canDragSnippets && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs font-bold text-amber-400">
            {snippet.favorite ? '★ ' : ''}
            {formatSnippetTrigger(snippet.trigger)}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-white">{snippet.name}</div>
          <div className="mt-1 text-xs text-zinc-500">{snippet.usageCount || 0} usos</div>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
      </div>
    </button>
  );
}

function SidebarCategoryNodeList({
  nodes,
  level,
  currentCategoryId,
  categoryCounts,
  snippetsByCategoryId,
  selectedSnippetId,
  canAcceptSnippetDrop,
  snippetDropCategoryId,
  onOpenCategory,
  onOpenSnippet,
  onSnippetDragStart,
  onSnippetDragEnd,
  onSnippetDragEnter,
  onSnippetDragLeave,
  onSnippetDrop,
}: {
  nodes: CategoryTreeNode[];
  level: number;
  currentCategoryId: string | null;
  categoryCounts: Map<string, number>;
  snippetsByCategoryId: Map<string, Snippet[]>;
  selectedSnippetId: string | null;
  canAcceptSnippetDrop: boolean;
  snippetDropCategoryId: string | null;
  onOpenCategory: (categoryId: string) => void;
  onOpenSnippet: (snippet: Snippet) => void;
  onSnippetDragStart: (snippetId: string) => void;
  onSnippetDragEnd: () => void;
  onSnippetDragEnter: (categoryId: string) => void;
  onSnippetDragLeave: (categoryId: string) => void;
  onSnippetDrop: (categoryId: string) => void;
}) {
  if (!nodes.length) return null;

  return (
    <div className="space-y-2">
      {nodes.map((node) => {
        const Icon = node.category.icon.kind === 'emoji' ? null : getLucideIcon(node.category.icon.value);
        const snippets = snippetsByCategoryId.get(node.category.id) ?? [];
        const hasChildren = Boolean(node.children.length || snippets.length);

        return (
          <AccordionItem key={node.category.id} value={node.category.id}>
            <div
              className={cn(
                'rounded-2xl border border-zinc-900 bg-zinc-950/80',
                currentCategoryId === node.category.id && 'border-amber-500/60 bg-amber-500/10',
                snippetDropCategoryId === node.category.id && 'border-amber-500/80 bg-amber-500/15'
              )}
              style={{ marginLeft: level * 12 }}
              onDragOver={
                canAcceptSnippetDrop
                  ? (event) => {
                      event.preventDefault();
                    }
                  : undefined
              }
              onDragEnter={canAcceptSnippetDrop ? () => onSnippetDragEnter(node.category.id) : undefined}
              onDragLeave={canAcceptSnippetDrop ? () => onSnippetDragLeave(node.category.id) : undefined}
              onDrop={
                canAcceptSnippetDrop
                  ? (event) => {
                      event.preventDefault();
                      onSnippetDrop(node.category.id);
                    }
                  : undefined
              }
            >
              <AccordionTrigger
                className="py-3 hover:no-underline"
                hideChevron={!hasChildren}
                onClick={() => onOpenCategory(node.category.id)}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-900 text-amber-400">
                    {node.category.icon.kind === 'emoji' ? <span className="text-lg">{node.category.icon.value}</span> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{node.category.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {categoryCounts.get(node.category.id) ?? 0} snippets
                    </span>
                  </span>
                </div>
              </AccordionTrigger>

              {hasChildren ? (
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-2 pl-4">
                    {snippets.map((snippet) => (
                      <SidebarSnippetButton
                        key={snippet.id}
                        snippet={snippet}
                        selectedSnippetId={selectedSnippetId}
                        canDragSnippets={canAcceptSnippetDrop}
                        onOpenSnippet={onOpenSnippet}
                        onSnippetDragStart={() => onSnippetDragStart(snippet.id)}
                        onSnippetDragEnd={onSnippetDragEnd}
                      />
                    ))}
                    <SidebarCategoryNodeList
                      nodes={node.children}
                      level={level + 1}
                      currentCategoryId={currentCategoryId}
                      categoryCounts={categoryCounts}
                      snippetsByCategoryId={snippetsByCategoryId}
                      selectedSnippetId={selectedSnippetId}
                      canAcceptSnippetDrop={canAcceptSnippetDrop}
                      snippetDropCategoryId={snippetDropCategoryId}
                      onOpenCategory={onOpenCategory}
                      onOpenSnippet={onOpenSnippet}
                      onSnippetDragStart={onSnippetDragStart}
                      onSnippetDragEnd={onSnippetDragEnd}
                      onSnippetDragEnter={onSnippetDragEnter}
                      onSnippetDragLeave={onSnippetDragLeave}
                      onSnippetDrop={onSnippetDrop}
                    />
                  </div>
                </AccordionContent>
              ) : null}
            </div>
          </AccordionItem>
        );
      })}
    </div>
  );
}

function SnippetEditorPane({
  draft,
  categoryLabel,
  onChangeDraft,
  onToggleFavorite,
  onDuplicate,
  onPreview,
  onDelete,
  onSave,
  onOpenCategoryPicker,
  onClearCategory,
}: {
  draft: SnippetDraft;
  categoryLabel: string;
  onChangeDraft: React.Dispatch<React.SetStateAction<SnippetDraft>>;
  onToggleFavorite: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onSave: () => void;
  onOpenCategoryPicker: () => void;
  onClearCategory: () => void;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-6xl px-7 py-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-black tracking-tight">{draft.id ? 'Editar Snippet' : 'Novo Snippet'}</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant={draft.favorite ? 'default' : 'secondary'} size="icon" onClick={onToggleFavorite}>
              <Star className="h-4 w-4" />
            </Button>
            <Button variant="secondary" onClick={onDuplicate} disabled={!draft.id}>
              <Copy className="h-4 w-4" />
              Duplicar
            </Button>
            <Button variant="secondary" onClick={onPreview}>
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={!draft.id}>
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
            <Button onClick={onSave}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <LabeledField label="Gatilho">
            <div className="space-y-2">
              <Input
                value={draft.trigger}
                onChange={(e) => onChangeDraft((state) => ({ ...state, trigger: e.target.value }))}
                onBlur={() => onChangeDraft((state) => ({ ...state, trigger: normalizeSnippetTriggerInput(state.trigger) }))}
                placeholder="meu-comando"
              />
              <div className="text-sm text-zinc-500">Digite só o identificador; no uso você expande com <span className="font-mono text-zinc-300">/gatilho</span>.</div>
            </div>
          </LabeledField>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <LabeledField label="Categoria">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onOpenCategoryPicker}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-900 text-amber-400">
                      <Folder className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Organização</div>
                      <div className="truncate text-sm font-semibold text-white">{categoryLabel}</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                </button>
                {draft.categoryId ? (
                  <Button variant="outline" size="sm" onClick={onClearCategory}>
                    Limpar categoria
                  </Button>
                ) : null}
              </div>
            </LabeledField>
            <LabeledField label="Tags">
              <Input value={draft.tags} onChange={(e) => onChangeDraft((state) => ({ ...state, tags: e.target.value }))} placeholder="email, suporte, vendas" />
            </LabeledField>
          </div>

          <LabeledField label="Nome">
            <Input value={draft.name} onChange={(e) => onChangeDraft((state) => ({ ...state, name: e.target.value }))} placeholder="Nome descritivo do snippet" />
          </LabeledField>

          <LabeledField label="Ações (Macro)">
            <MacroActionEditor actions={draft.actions} onChange={(actions) => onChangeDraft((state) => ({ ...state, actions }))} />
          </LabeledField>
        </div>
      </div>
    </ScrollArea>
  );
}

function CategoryPickerDialog({
  open,
  categories,
  expandedIds,
  selectedCategoryId,
  onOpenChange,
  onToggleExpanded,
  onSelectCategory,
  onClearCategory,
  onOpenManager,
}: {
  open: boolean;
  categories: CategoryTreeNode[];
  expandedIds: Set<string>;
  selectedCategoryId: string | null;
  onOpenChange: (open: boolean) => void;
  onToggleExpanded: (categoryId: string) => void;
  onSelectCategory: (categoryId: string) => void;
  onClearCategory: () => void;
  onOpenManager: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,640px)] max-w-[640px] overflow-hidden p-0">
        <div className="flex max-h-[85vh] min-h-0 flex-col">
          <DialogHeader className="border-b border-zinc-900 px-6 py-5">
            <DialogTitle>Escolher categoria</DialogTitle>
            <DialogDescription>Selecione onde este snippet será organizado.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {categories.length ? (
              <CategoryTree
                nodes={categories}
                expandedIds={expandedIds}
                selectedCategoryId={selectedCategoryId}
                onToggleExpanded={onToggleExpanded}
                onSelectCategory={onSelectCategory}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/70 px-4 py-8 text-center text-sm text-zinc-500">
                Nenhuma categoria cadastrada ainda.
              </div>
            )}
          </div>
          <DialogFooter className="mt-0">
            <Button variant="secondary" onClick={onOpenManager}>Gerenciar categorias</Button>
            <Button variant="outline" onClick={onClearCategory}>Sem categoria</Button>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryManagerDialog({
  open,
  categories,
  tree,
  expandedIds,
  selectedCategoryId,
  categoryDraft,
  categoryCounts,
  sensors,
  getCategoryPath,
  getSortModeForParent,
  onOpenChange,
  onToggleExpanded,
  onSelectCategory,
  onCreateRoot,
  onCreateChild,
  onDeleteSelected,
  onSaveDraft,
  onChangeDraft,
  onChooseIcon,
  onReorder,
  onSetSortMode,
}: {
  open: boolean;
  categories: Category[];
  tree: CategoryTreeNode[];
  expandedIds: Set<string>;
  selectedCategoryId: string | null;
  categoryDraft: CategoryDraftState | null;
  categoryCounts: Map<string, number>;
  sensors: ReturnType<typeof useSensors>;
  getCategoryPath: (id: string | null) => string;
  getSortModeForParent: (parentId: string | null) => 'manual' | 'alphabetical';
  onOpenChange: (open: boolean) => void;
  onToggleExpanded: (categoryId: string) => void;
  onSelectCategory: (categoryId: string) => void;
  onCreateRoot: () => void;
  onCreateChild: () => void;
  onDeleteSelected: () => void;
  onSaveDraft: () => void;
  onChangeDraft: React.Dispatch<React.SetStateAction<CategoryDraftState | null>>;
  onChooseIcon: (initial: CategoryIcon) => Promise<CategoryIcon | null>;
  onReorder: (event: DragEndEvent) => void;
  onSetSortMode: (sortMode: 'manual' | 'alphabetical', parentId: string | null) => void;
}) {
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
  const selectedParentId = selectedCategory?.parentId ?? null;
  const selectedLevelParentId = categoryDraft?.mode === 'create-root' ? null : selectedParentId;
  const levelSortMode = getSortModeForParent(selectedLevelParentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,1100px)] max-w-[1100px] overflow-hidden p-0">
        <div className="flex max-h-[88vh] min-h-0 flex-col">
          <DialogHeader className="border-b border-zinc-900 px-6 py-5">
            <DialogTitle>Gerenciar categorias</DialogTitle>
            <DialogDescription>Edite a estrutura completa da biblioteca sem navegar por telas separadas.</DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
            <div className="min-h-0 border-b border-zinc-900 md:border-b-0 md:border-r">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-900 px-4 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Estrutura</div>
                  <div className="text-sm font-semibold text-white">{selectedCategory ? getCategoryPath(selectedCategory.id) : 'Raiz'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ArrowUpDown className="h-4 w-4" />
                        Ordenar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel>Ordenação do nível</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={levelSortMode}
                        onValueChange={(value) => onSetSortMode(value as 'manual' | 'alphabetical', selectedLevelParentId)}
                      >
                        <DropdownMenuRadioItem value="manual">Manual</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="alphabetical">Alfabética</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="secondary" size="sm" onClick={onCreateRoot}>
                    <FolderPlus className="h-4 w-4" />
                    Nova
                  </Button>
                </div>
              </div>
              <div className="min-h-0 overflow-y-auto px-3 py-3">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorder}>
                  {tree.length ? (
                    <CategoryTree
                      nodes={tree}
                      expandedIds={expandedIds}
                      selectedCategoryId={selectedCategoryId}
                      onToggleExpanded={onToggleExpanded}
                      onSelectCategory={onSelectCategory}
                      draggableParentsMode={getSortModeForParent}
                      categoryCounts={categoryCounts}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/70 px-4 py-8 text-center text-sm text-zinc-500">
                      Nenhuma categoria cadastrada ainda.
                    </div>
                  )}
                </DndContext>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto px-6 py-6">
              <CategoryDetailPane
                category={selectedCategory}
                categoryDraft={categoryDraft}
                categoryOptions={categories
                  .filter((category) => category.id !== categoryDraft?.id && !getDescendantIds(categoryDraft?.id ?? '', categories).includes(category.id))
                  .map((category) => ({ id: category.id, path: getCategoryPath(category.id) }))}
                categoryCounts={categoryCounts}
                onCreateChild={onCreateChild}
                onDelete={onDeleteSelected}
                onSave={onSaveDraft}
                onChangeDraft={onChangeDraft}
                onChooseIcon={onChooseIcon}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryTree({
  nodes,
  expandedIds,
  selectedCategoryId,
  onToggleExpanded,
  onSelectCategory,
  draggableParentsMode,
  categoryCounts,
}: {
  nodes: CategoryTreeNode[];
  expandedIds: Set<string>;
  selectedCategoryId: string | null;
  onToggleExpanded: (categoryId: string) => void;
  onSelectCategory: (categoryId: string) => void;
  draggableParentsMode?: (parentId: string | null) => 'manual' | 'alphabetical';
  categoryCounts?: Map<string, number>;
}) {
  if (!nodes.length) return null;
  const parentId = nodes[0]?.category.parentId ?? null;
  const isDraggable = draggableParentsMode ? draggableParentsMode(parentId) === 'manual' : false;

  const content = (
    <div className="space-y-1">
      {nodes.map((node) => (
        <CategoryTreeItem
          key={node.category.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          selectedCategoryId={selectedCategoryId}
          onToggleExpanded={onToggleExpanded}
          onSelectCategory={onSelectCategory}
          draggableParentsMode={draggableParentsMode}
          categoryCounts={categoryCounts}
          isDraggable={isDraggable}
        />
      ))}
    </div>
  );

  return isDraggable ? <SortableContext items={nodes.map((node) => node.category.id)} strategy={verticalListSortingStrategy}>{content}</SortableContext> : content;
}

function CategoryTreeItem({
  node,
  depth,
  expandedIds,
  selectedCategoryId,
  onToggleExpanded,
  onSelectCategory,
  draggableParentsMode,
  categoryCounts,
  isDraggable,
}: {
  node: CategoryTreeNode;
  depth: number;
  expandedIds: Set<string>;
  selectedCategoryId: string | null;
  onToggleExpanded: (categoryId: string) => void;
  onSelectCategory: (categoryId: string) => void;
  draggableParentsMode?: (parentId: string | null) => 'manual' | 'alphabetical';
  categoryCounts?: Map<string, number>;
  isDraggable: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.category.id);
  const Icon = node.category.icon.kind === 'emoji' ? null : getLucideIcon(node.category.icon.value);
  const sortable = useSortable({ id: node.category.id, disabled: !isDraggable });
  const style = isDraggable
    ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
    : undefined;

  return (
    <div ref={sortable.setNodeRef} style={style} className={cn(isDraggable && sortable.isDragging && 'opacity-60')}>
      <div
        className={cn(
          'rounded-2xl border transition-colors',
          selectedCategoryId === node.category.id
            ? 'border-amber-500/60 bg-amber-500/10'
            : 'border-transparent hover:border-zinc-800 hover:bg-zinc-900/70'
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2" style={{ paddingLeft: 12 + depth * 18 }}>
          <button
            type="button"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            onClick={() => hasChildren && onToggleExpanded(node.category.id)}
            aria-label={hasChildren ? (isExpanded ? 'Recolher categoria' : 'Expandir categoria') : 'Sem subcategorias'}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <span className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => onSelectCategory(node.category.id)}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zinc-950 text-amber-400">
              {node.category.icon.kind === 'emoji' ? <span className="text-base">{node.category.icon.value}</span> : <Icon className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{node.category.name}</div>
              {categoryCounts ? <div className="text-xs text-zinc-500">{categoryCounts.get(node.category.id) ?? 0} snippets</div> : null}
            </div>
          </button>
          {isDraggable ? (
            <button
              type="button"
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label={`Reordenar ${node.category.name}`}
              {...sortable.attributes}
              {...sortable.listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {hasChildren && isExpanded ? (
        <div className="mt-1">
          <CategoryTreeLevel
            nodes={node.children}
            depth={depth + 1}
            expandedIds={expandedIds}
            selectedCategoryId={selectedCategoryId}
            onToggleExpanded={onToggleExpanded}
            onSelectCategory={onSelectCategory}
            draggableParentsMode={draggableParentsMode}
            categoryCounts={categoryCounts}
          />
        </div>
      ) : null}
    </div>
  );
}

function CategoryTreeLevel({
  nodes,
  depth,
  expandedIds,
  selectedCategoryId,
  onToggleExpanded,
  onSelectCategory,
  draggableParentsMode,
  categoryCounts,
}: {
  nodes: CategoryTreeNode[];
  depth: number;
  expandedIds: Set<string>;
  selectedCategoryId: string | null;
  onToggleExpanded: (categoryId: string) => void;
  onSelectCategory: (categoryId: string) => void;
  draggableParentsMode?: (parentId: string | null) => 'manual' | 'alphabetical';
  categoryCounts?: Map<string, number>;
}) {
  const parentId = nodes[0]?.category.parentId ?? null;
  const isDraggable = draggableParentsMode ? draggableParentsMode(parentId) === 'manual' : false;
  const content = (
    <div className="space-y-1">
      {nodes.map((node) => (
        <CategoryTreeItem
          key={node.category.id}
          node={node}
          depth={depth}
          expandedIds={expandedIds}
          selectedCategoryId={selectedCategoryId}
          onToggleExpanded={onToggleExpanded}
          onSelectCategory={onSelectCategory}
          draggableParentsMode={draggableParentsMode}
          categoryCounts={categoryCounts}
          isDraggable={isDraggable}
        />
      ))}
    </div>
  );
  return isDraggable ? <SortableContext items={nodes.map((node) => node.category.id)} strategy={verticalListSortingStrategy}>{content}</SortableContext> : content;
}

function CategoryDetailPane({
  category,
  categoryDraft,
  categoryOptions,
  categoryCounts,
  onCreateChild,
  onDelete,
  onSave,
  onChangeDraft,
  onChooseIcon,
}: {
  category: Category | null;
  categoryDraft: CategoryDraftState | null;
  categoryOptions: Array<{ id: string; path: string }>;
  categoryCounts: Map<string, number>;
  onCreateChild: () => void;
  onDelete: () => void;
  onSave: () => void;
  onChangeDraft: React.Dispatch<React.SetStateAction<CategoryDraftState | null>>;
  onChooseIcon: (initial: CategoryIcon) => Promise<CategoryIcon | null>;
}) {
  if (!categoryDraft) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/60 p-10 text-center text-zinc-500">
        <div>
          <FolderCog className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <div className="text-lg font-semibold text-zinc-300">Selecione uma categoria na árvore para editar</div>
          <div className="mt-2 text-sm">Ou crie uma nova categoria raiz para começar a organizar a biblioteca.</div>
        </div>
      </div>
    );
  }

  const iconLabel = categoryDraft.icon.kind === 'emoji' ? categoryDraft.icon.value : categoryDraft.icon.value;
  const Icon = categoryDraft.icon.kind === 'emoji' ? null : getLucideIcon(categoryDraft.icon.value);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              {categoryDraft.mode === 'edit' ? 'Editar categoria' : categoryDraft.mode === 'create-child' ? 'Nova subcategoria' : 'Nova categoria raiz'}
            </div>
            <div className="mt-1 text-2xl font-black tracking-tight text-white">
              {categoryDraft.mode === 'edit' ? categoryDraft.name || 'Categoria sem nome' : 'Nova categoria'}
            </div>
            {category ? (
              <div className="mt-2 text-sm text-zinc-400">
                {categoryCounts.get(category.id) ?? 0} snippets vinculados
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {category ? (
              <Button variant="secondary" onClick={onCreateChild}>
                <FolderPlus className="h-4 w-4" />
                Nova subcategoria
              </Button>
            ) : null}
            {categoryDraft.mode === 'edit' ? (
              <Button variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            ) : null}
            <Button onClick={onSave}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
        <LabeledField label="Nome">
          <Input
            value={categoryDraft.name}
            onChange={(e) => onChangeDraft((current) => (current ? { ...current, name: e.target.value } : current))}
            placeholder="Nome da categoria"
          />
        </LabeledField>

        <LabeledField label="Pasta Pai">
          <Select
            value={categoryDraft.parentId ?? '__root__'}
            onValueChange={(value) =>
              onChangeDraft((current) =>
                current
                  ? {
                      ...current,
                      parentId: value === '__root__' ? null : value,
                    }
                  : current
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Raiz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">Raiz</SelectItem>
              {categoryOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.path}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>

        <LabeledField label="Ícone">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-900 text-amber-400">
              {categoryDraft.icon.kind === 'emoji' ? <span className="text-xl">{categoryDraft.icon.value}</span> : <Icon className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-zinc-200">{iconLabel}</div>
              <div className="text-xs text-zinc-500">Escolha um ícone Lucide ou um emoji simples.</div>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                const icon = await onChooseIcon(categoryDraft.icon);
                if (!icon) return;
                onChangeDraft((current) => (current ? { ...current, icon } : current));
              }}
            >
              Escolher ícone
            </Button>
          </div>
        </LabeledField>
      </div>
    </div>
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
