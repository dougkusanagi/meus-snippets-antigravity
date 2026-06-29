export type CategoryIcon = {
  kind: 'lucide' | 'emoji';
  value: string;
};

export type Category = {
  id: string;
  name: string;
  parentId: string | null;
  icon: CategoryIcon;
  sortMode: 'manual' | 'alphabetical';
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type MacroAction =
  | { type: 'text'; value: string }
  | { type: 'key'; key: string; modifiers?: string[] | null }
  | { type: 'delay'; milliseconds: number };

export type Snippet = {
  id: string;
  trigger: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  categoryPath: string;
  tags: string[];
  favorite: boolean;
  actions: MacroAction[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  lastUsedAt: string | null;
};

export type LibrarySnapshot = {
  snippets: Snippet[];
  categories: Category[];
};
