use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use uuid::Uuid;

const STORE_VERSION: u32 = 2;
const MAX_TRIGGER_LEN: usize = 100;
const MAX_NAME_LEN: usize = 200;
const MAX_CATEGORY_NAME_LEN: usize = 100;
const MAX_TAGS: usize = 20;
const MAX_TAG_LEN: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum MacroAction {
    #[serde(rename = "text")]
    Text { value: String },
    #[serde(rename = "key")]
    Key {
        key: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        modifiers: Option<Vec<String>>,
    },
    #[serde(rename = "delay")]
    Delay { milliseconds: u64 },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CategoryIconKind {
    Lucide,
    Emoji,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CategoryIcon {
    pub kind: CategoryIconKind,
    pub value: String,
}

impl Default for CategoryIcon {
    fn default() -> Self {
        Self {
            kind: CategoryIconKind::Lucide,
            value: "folder".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CategorySortMode {
    Manual,
    Alphabetical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub icon: CategoryIcon,
    #[serde(default)]
    pub sort_mode: CategorySortMode,
    #[serde(default)]
    pub sort_index: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl Default for CategorySortMode {
    fn default() -> Self {
        Self::Manual
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snippet {
    pub id: String,
    pub trigger: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category_id: Option<String>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub favorite: bool,
    pub actions: Vec<MacroAction>,
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub usage_count: u64,
    #[serde(default)]
    pub last_used_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetInput {
    pub trigger: String,
    pub name: String,
    #[serde(default)]
    pub category_id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub favorite: bool,
    pub actions: Vec<MacroAction>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetView {
    pub id: String,
    pub trigger: String,
    pub name: String,
    pub category_id: Option<String>,
    pub category_name: String,
    pub category_path: String,
    pub tags: Vec<String>,
    pub favorite: bool,
    pub actions: Vec<MacroAction>,
    pub created_at: String,
    pub updated_at: String,
    pub usage_count: u64,
    pub last_used_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySnapshot {
    pub snippets: Vec<SnippetView>,
    pub categories: Vec<Category>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoreFile {
    version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    exported_at: Option<String>,
    #[serde(default)]
    categories: Vec<Category>,
    snippets: Vec<Snippet>,
}

#[derive(Debug, Clone)]
struct StoreData {
    snippets: Vec<Snippet>,
    categories: Vec<Category>,
    migrated: bool,
}

#[derive(Debug, Deserialize)]
struct LegacyStoreFile {
    version: u32,
    snippets: Vec<LegacySnippet>,
}

#[derive(Debug, Clone, Deserialize)]
struct LegacySnippet {
    id: String,
    trigger: String,
    name: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    favorite: bool,
    actions: Vec<MacroAction>,
    created_at: String,
    #[serde(default)]
    updated_at: String,
    #[serde(default)]
    usage_count: u64,
    #[serde(default)]
    last_used_at: Option<String>,
}

pub struct SnippetStore {
    snippets: Mutex<Vec<Snippet>>,
    categories: Mutex<Vec<Category>>,
    file_path: Mutex<PathBuf>,
}

impl SnippetStore {
    pub fn new() -> Self {
        Self {
            snippets: Mutex::new(Vec::new()),
            categories: Mutex::new(Vec::new()),
            file_path: Mutex::new(PathBuf::new()),
        }
    }

    pub fn init(&self, app_data_dir: PathBuf) -> Result<(), String> {
        let file_path = app_data_dir.join("snippets.json");
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Falha ao criar diretório de dados: {e}"))?;

        let data = if file_path.exists() {
            match Self::read_store(&file_path) {
                Ok(items) => items,
                Err(error) => {
                    let corrupt_path = app_data_dir.join(format!(
                        "snippets.corrupt-{}.json",
                        Utc::now().format("%Y%m%d-%H%M%S")
                    ));
                    fs::copy(&file_path, &corrupt_path).map_err(|copy_error| {
                        format!(
                            "{error}. Também não foi possível preservar o arquivo corrompido: {copy_error}"
                        )
                    })?;
                    return Err(format!(
                        "{error}. Uma cópia foi preservada em {}",
                        corrupt_path.display()
                    ));
                }
            }
        } else {
            StoreData {
                snippets: Vec::new(),
                categories: Vec::new(),
                migrated: false,
            }
        };

        *self
            .snippets
            .lock()
            .map_err(|_| "Falha ao bloquear armazenamento".to_string())? = data.snippets;
        *self
            .categories
            .lock()
            .map_err(|_| "Falha ao bloquear categorias".to_string())? = data.categories;
        *self
            .file_path
            .lock()
            .map_err(|_| "Falha ao bloquear caminho do armazenamento".to_string())? = file_path;

        if data.migrated {
            self.save_to_disk()?;
        }

        Ok(())
    }

    pub fn get_all(&self) -> Result<Vec<Snippet>, String> {
        Ok(self
            .snippets
            .lock()
            .map_err(|_| "Falha ao bloquear armazenamento".to_string())?
            .clone())
    }

    pub fn get_all_categories(&self) -> Result<Vec<Category>, String> {
        Ok(self
            .categories
            .lock()
            .map_err(|_| "Falha ao bloquear categorias".to_string())?
            .clone())
    }

    pub fn get_snapshot(&self) -> Result<LibrarySnapshot, String> {
        let snippets = self.get_all()?;
        let categories = self.get_all_categories()?;
        let paths = Self::category_paths(&categories);
        Ok(LibrarySnapshot {
            snippets: snippets
                .into_iter()
                .map(|snippet| Self::snippet_view_from(snippet, &paths))
                .collect(),
            categories,
        })
    }

    pub fn get_picker_snippets(&self) -> Result<Vec<SnippetView>, String> {
        let snippets = self.get_all()?;
        let categories = self.get_all_categories()?;
        let paths = Self::category_paths(&categories);
        Ok(snippets
            .into_iter()
            .map(|snippet| Self::snippet_view_from(snippet, &paths))
            .collect())
    }

    pub fn get_by_id(&self, id: &str) -> Result<Option<Snippet>, String> {
        Ok(self
            .snippets
            .lock()
            .map_err(|_| "Falha ao bloquear armazenamento".to_string())?
            .iter()
            .find(|snippet| snippet.id == id)
            .cloned())
    }

    pub fn add(&self, input: SnippetInput) -> Result<Snippet, String> {
        let input = self.validate_input(input, None)?;
        let now = Utc::now().to_rfc3339();
        let snippet = Snippet {
            id: Uuid::new_v4().to_string(),
            trigger: input.trigger,
            name: input.name,
            category_id: input.category_id,
            category: String::new(),
            tags: input.tags,
            favorite: input.favorite,
            actions: input.actions,
            created_at: now.clone(),
            updated_at: now,
            usage_count: 0,
            last_used_at: None,
        };

        let previous = {
            let mut snippets = self
                .snippets
                .lock()
                .map_err(|_| "Falha ao bloquear armazenamento".to_string())?;
            let previous = snippets.clone();
            snippets.push(snippet.clone());
            previous
        };
        self.save_with_rollback(Some(previous), None)?;
        Ok(snippet)
    }

    pub fn update(&self, id: &str, input: SnippetInput) -> Result<Snippet, String> {
        let input = self.validate_input(input, Some(id))?;
        let (updated, previous) = {
            let mut snippets = self
                .snippets
                .lock()
                .map_err(|_| "Falha ao bloquear armazenamento".to_string())?;
            let previous = snippets.clone();
            let snippet = snippets
                .iter_mut()
                .find(|snippet| snippet.id == id)
                .ok_or_else(|| format!("Snippet não encontrado: {id}"))?;
            snippet.trigger = input.trigger;
            snippet.name = input.name;
            snippet.category_id = input.category_id;
            snippet.category.clear();
            snippet.tags = input.tags;
            snippet.favorite = input.favorite;
            snippet.actions = input.actions;
            snippet.updated_at = Utc::now().to_rfc3339();
            (snippet.clone(), previous)
        };
        self.save_with_rollback(Some(previous), None)?;
        Ok(updated)
    }

    pub fn delete(&self, id: &str) -> Result<bool, String> {
        let (deleted, previous) = {
            let mut snippets = self
                .snippets
                .lock()
                .map_err(|_| "Falha ao bloquear armazenamento".to_string())?;
            let previous = snippets.clone();
            let original_len = snippets.len();
            snippets.retain(|snippet| snippet.id != id);
            (snippets.len() < original_len, previous)
        };
        if deleted {
            self.save_with_rollback(Some(previous), None)?;
        }
        Ok(deleted)
    }

    pub fn duplicate(&self, id: &str) -> Result<Snippet, String> {
        let source = self
            .get_by_id(id)?
            .ok_or_else(|| format!("Snippet não encontrado: {id}"))?;
        let unique_trigger = self.unique_trigger(&format!("{}-copia", source.trigger))?;
        self.add(SnippetInput {
            trigger: unique_trigger,
            name: format!("{} (cópia)", source.name),
            category_id: source.category_id,
            tags: source.tags,
            favorite: false,
            actions: source.actions,
        })
    }

    pub fn set_favorite(&self, id: &str, favorite: bool) -> Result<Snippet, String> {
        let (updated, previous) = {
            let mut snippets = self
                .snippets
                .lock()
                .map_err(|_| "Falha ao bloquear armazenamento".to_string())?;
            let previous = snippets.clone();
            let snippet = snippets
                .iter_mut()
                .find(|snippet| snippet.id == id)
                .ok_or_else(|| format!("Snippet não encontrado: {id}"))?;
            snippet.favorite = favorite;
            snippet.updated_at = Utc::now().to_rfc3339();
            (snippet.clone(), previous)
        };
        self.save_with_rollback(Some(previous), None)?;
        Ok(updated)
    }

    pub fn record_usage(&self, id: &str) -> Result<(), String> {
        let previous = {
            let mut snippets = self
                .snippets
                .lock()
                .map_err(|_| "Falha ao bloquear armazenamento".to_string())?;
            let previous = snippets.clone();
            let snippet = snippets
                .iter_mut()
                .find(|snippet| snippet.id == id)
                .ok_or_else(|| format!("Snippet não encontrado: {id}"))?;
            snippet.usage_count = snippet.usage_count.saturating_add(1);
            snippet.last_used_at = Some(Utc::now().to_rfc3339());
            previous
        };
        self.save_with_rollback(Some(previous), None)
    }

    pub fn create_category(
        &self,
        name: String,
        parent_id: Option<String>,
        icon: Option<CategoryIcon>,
    ) -> Result<Category, String> {
        let category = self.prepare_new_category(name, parent_id, icon)?;
        let previous = {
            let mut categories = self
                .categories
                .lock()
                .map_err(|_| "Falha ao bloquear categorias".to_string())?;
            let previous = categories.clone();
            categories.push(category.clone());
            previous
        };
        self.save_with_rollback(None, Some(previous))?;
        Ok(category)
    }

    pub fn update_category(
        &self,
        id: &str,
        name: String,
        parent_id: Option<String>,
        icon: Option<CategoryIcon>,
    ) -> Result<Category, String> {
        let sanitized_name = Self::normalize_category_name(&name)?;
        let validated_parent = self.validate_category_parent(id, parent_id.as_deref())?;
        let category_icon = Self::normalize_category_icon(icon)?;

        let (updated, previous) = {
            let mut categories = self
                .categories
                .lock()
                .map_err(|_| "Falha ao bloquear categorias".to_string())?;
            let previous = categories.clone();
            let index = categories
                .iter()
                .position(|category| category.id == id)
                .ok_or_else(|| format!("Categoria não encontrada: {id}"))?;

            if categories.iter().any(|category| {
                category.id != id
                    && category.parent_id == validated_parent
                    && category.name.eq_ignore_ascii_case(&sanitized_name)
            }) {
                return Err(format!(
                    "Já existe uma categoria irmã com o nome '{}'",
                    sanitized_name
                ));
            }

            let current_sort_index = categories[index].sort_index;
            categories[index].name = sanitized_name;
            categories[index].parent_id = validated_parent;
            categories[index].icon = category_icon;
            categories[index].sort_index = current_sort_index;
            categories[index].updated_at = Utc::now().to_rfc3339();
            (categories[index].clone(), previous)
        };
        self.save_with_rollback(None, Some(previous))?;
        Ok(updated)
    }

    pub fn delete_category(&self, id: &str) -> Result<bool, String> {
        {
            let categories = self
                .categories
                .lock()
                .map_err(|_| "Falha ao bloquear categorias".to_string())?;
            if categories.iter().any(|category| category.parent_id.as_deref() == Some(id)) {
                return Err("A categoria possui subcategorias".to_string());
            }
        }

        {
            let snippets = self
                .snippets
                .lock()
                .map_err(|_| "Falha ao bloquear armazenamento".to_string())?;
            if snippets.iter().any(|snippet| snippet.category_id.as_deref() == Some(id)) {
                return Err("A categoria possui snippets vinculados".to_string());
            }
        }

        let (deleted, previous) = {
            let mut categories = self
                .categories
                .lock()
                .map_err(|_| "Falha ao bloquear categorias".to_string())?;
            let previous = categories.clone();
            let original_len = categories.len();
            categories.retain(|category| category.id != id);
            (categories.len() < original_len, previous)
        };
        if deleted {
            self.save_with_rollback(None, Some(previous))?;
        }
        Ok(deleted)
    }

    pub fn reorder_categories(
        &self,
        parent_id: Option<String>,
        ordered_ids: Vec<String>,
    ) -> Result<Vec<Category>, String> {
        let (updated, previous) = {
            let mut categories = self
                .categories
                .lock()
                .map_err(|_| "Falha ao bloquear categorias".to_string())?;
            let previous = categories.clone();
            let siblings: Vec<String> = categories
                .iter()
                .filter(|category| category.parent_id == parent_id)
                .map(|category| category.id.clone())
                .collect();

            if siblings.len() != ordered_ids.len() {
                return Err("A nova ordem não corresponde às categorias irmãs".to_string());
            }
            let sibling_set: HashSet<&str> = siblings.iter().map(String::as_str).collect();
            if ordered_ids.iter().any(|id| !sibling_set.contains(id.as_str())) {
                return Err("A ordem contém categorias inválidas".to_string());
            }

            for (index, id) in ordered_ids.iter().enumerate() {
                if let Some(category) = categories.iter_mut().find(|category| category.id == *id) {
                    category.sort_index = index as i64;
                    category.updated_at = Utc::now().to_rfc3339();
                }
            }

            let updated = categories
                .iter()
                .filter(|category| category.parent_id == parent_id)
                .cloned()
                .collect::<Vec<_>>();
            (updated, previous)
        };

        self.save_with_rollback(None, Some(previous))?;
        Ok(updated)
    }

    pub fn set_category_sort_mode(
        &self,
        parent_id: Option<String>,
        sort_mode: CategorySortMode,
    ) -> Result<(), String> {
        let previous = {
            let mut categories = self
                .categories
                .lock()
                .map_err(|_| "Falha ao bloquear categorias".to_string())?;
            let previous = categories.clone();
            if let Some(parent_id) = parent_id.as_deref() {
                let parent = categories
                    .iter_mut()
                    .find(|category| category.id == parent_id)
                    .ok_or_else(|| format!("Categoria não encontrada: {parent_id}"))?;
                parent.sort_mode = sort_mode;
                parent.updated_at = Utc::now().to_rfc3339();
            } else {
                for category in categories.iter_mut().filter(|category| category.parent_id.is_none()) {
                    category.sort_mode = sort_mode.clone();
                    category.updated_at = Utc::now().to_rfc3339();
                }
            }
            previous
        };
        self.save_with_rollback(None, Some(previous))
    }

    pub fn export_json(&self) -> Result<String, String> {
        let data = StoreFile {
            version: STORE_VERSION,
            exported_at: Some(Utc::now().to_rfc3339()),
            categories: self.get_all_categories()?,
            snippets: self.get_all()?,
        };
        serde_json::to_string_pretty(&data).map_err(|e| format!("Falha ao exportar snippets: {e}"))
    }

    pub fn export_to_file(&self, path: &Path) -> Result<(), String> {
        let content = self.export_json()?;
        fs::write(path, content).map_err(|e| format!("Falha ao gravar backup: {e}"))
    }

    pub fn import_from_file(&self, path: &Path, replace: bool) -> Result<usize, String> {
        let content = fs::read_to_string(path).map_err(|e| format!("Falha ao ler backup: {e}"))?;
        self.import_json(&content, replace)
    }

    pub fn import_json(&self, content: &str, replace: bool) -> Result<usize, String> {
        let incoming = Self::read_store_content(content)?;
        let imported_count = incoming.snippets.len();

        if replace {
            Self::validate_library(&incoming.snippets, &incoming.categories)?;
            let previous_snippets = self
                .snippets
                .lock()
                .map_err(|_| "Falha ao bloquear armazenamento".to_string())?
                .clone();
            let previous_categories = self
                .categories
                .lock()
                .map_err(|_| "Falha ao bloquear categorias".to_string())?
                .clone();

            *self
                .snippets
                .lock()
                .map_err(|_| "Falha ao bloquear armazenamento".to_string())? = incoming.snippets;
            *self
                .categories
                .lock()
                .map_err(|_| "Falha ao bloquear categorias".to_string())? = incoming.categories;

            self.save_with_rollback(Some(previous_snippets), Some(previous_categories))?;
            return Ok(imported_count);
        }

        let previous_snippets = self
            .snippets
            .lock()
            .map_err(|_| "Falha ao bloquear armazenamento".to_string())?
            .clone();
        let previous_categories = self
            .categories
            .lock()
            .map_err(|_| "Falha ao bloquear categorias".to_string())?
            .clone();

        let mut merged_categories = previous_categories.clone();
        let mut id_map = HashMap::<String, Option<String>>::new();
        let mut ordered = incoming.categories.clone();
        ordered.sort_by_key(Self::category_depth);

        for category in ordered {
            let mapped_parent = category
                .parent_id
                .as_ref()
                .and_then(|parent_id| id_map.get(parent_id).cloned().flatten());

            if let Some(existing) = merged_categories.iter().find(|item| {
                item.parent_id == mapped_parent && item.name.eq_ignore_ascii_case(&category.name)
            }) {
                id_map.insert(category.id.clone(), Some(existing.id.clone()));
                continue;
            }

            let unique_name = Self::unique_category_name_in(
                &merged_categories,
                mapped_parent.as_deref(),
                &category.name,
            );
            let mut created = category.clone();
            created.id = Uuid::new_v4().to_string();
            created.parent_id = mapped_parent;
            created.name = unique_name;
            created.updated_at = Utc::now().to_rfc3339();
            created.created_at = if created.created_at.is_empty() {
                Utc::now().to_rfc3339()
            } else {
                created.created_at
            };
            id_map.insert(category.id, Some(created.id.clone()));
            merged_categories.push(created);
        }

        let mut merged_snippets = previous_snippets.clone();
        for mut snippet in incoming.snippets {
            snippet.category_id = snippet
                .category_id
                .as_ref()
                .and_then(|category_id| id_map.get(category_id).cloned().flatten());
            snippet.category.clear();
            if merged_snippets.iter().any(|item| {
                item.id == snippet.id || item.trigger.eq_ignore_ascii_case(&snippet.trigger)
            }) {
                snippet.id = Uuid::new_v4().to_string();
                snippet.trigger =
                    Self::unique_trigger_in(&merged_snippets, &format!("{}-importado", snippet.trigger));
            }
            merged_snippets.push(snippet);
        }

        Self::validate_library(&merged_snippets, &merged_categories)?;
        *self
            .snippets
            .lock()
            .map_err(|_| "Falha ao bloquear armazenamento".to_string())? = merged_snippets;
        *self
            .categories
            .lock()
            .map_err(|_| "Falha ao bloquear categorias".to_string())? = merged_categories;

        self.save_with_rollback(Some(previous_snippets), Some(previous_categories))?;
        Ok(imported_count)
    }

    fn read_store(path: &Path) -> Result<StoreData, String> {
        let content =
            fs::read_to_string(path).map_err(|e| format!("Falha ao ler snippets: {e}"))?;
        Self::read_store_content(&content)
    }

    fn read_store_content(content: &str) -> Result<StoreData, String> {
        if let Ok(store) = serde_json::from_str::<StoreFile>(content) {
            let migrated = store.version < STORE_VERSION;
            let snippets = store
                .snippets
                .into_iter()
                .map(Self::normalize_snippet)
                .collect::<Result<Vec<_>, _>>()?;
            let categories = store
                .categories
                .into_iter()
                .map(Self::normalize_category)
                .collect::<Result<Vec<_>, _>>()?;
            let (snippets, categories, auto_migrated) =
                Self::migrate_legacy_categories(snippets, categories)?;
            return Ok(StoreData {
                snippets,
                categories,
                migrated: migrated || auto_migrated,
            });
        }

        if let Ok(store) = serde_json::from_str::<LegacyStoreFile>(content) {
            let _ = store.version;
            let legacy_snippets = store
                .snippets
                .into_iter()
                .map(Self::from_legacy_snippet)
                .collect::<Vec<_>>();
            let (snippets, categories, _) =
                Self::migrate_legacy_categories(legacy_snippets, Vec::new())?;
            return Ok(StoreData {
                snippets,
                categories,
                migrated: true,
            });
        }

        let legacy = serde_json::from_str::<Vec<LegacySnippet>>(content)
            .map_err(|e| format!("Arquivo de snippets inválido: {e}"))?;
        let snippets = legacy.into_iter().map(Self::from_legacy_snippet).collect();
        let (snippets, categories, _) = Self::migrate_legacy_categories(snippets, Vec::new())?;
        Ok(StoreData {
            snippets,
            categories,
            migrated: true,
        })
    }

    fn save_to_disk(&self) -> Result<(), String> {
        let snippets = self
            .snippets
            .lock()
            .map_err(|_| "Falha ao bloquear armazenamento".to_string())?
            .clone();
        let categories = self
            .categories
            .lock()
            .map_err(|_| "Falha ao bloquear categorias".to_string())?
            .clone();
        let path = self
            .file_path
            .lock()
            .map_err(|_| "Falha ao bloquear caminho do armazenamento".to_string())?
            .clone();

        if path.as_os_str().is_empty() {
            return Err("Armazenamento ainda não foi inicializado".to_string());
        }

        Self::validate_library(&snippets, &categories)?;
        let data = StoreFile {
            version: STORE_VERSION,
            exported_at: Some(Utc::now().to_rfc3339()),
            categories,
            snippets,
        };
        let json = serde_json::to_string_pretty(&data)
            .map_err(|e| format!("Falha ao serializar snippets: {e}"))?;
        let temp_path = path.with_extension("json.tmp");
        let backup_path = path.with_extension("json.bak");

        fs::write(&temp_path, json)
            .map_err(|e| format!("Falha ao gravar arquivo temporário: {e}"))?;

        if path.exists() {
            fs::copy(&path, &backup_path)
                .map_err(|e| format!("Falha ao criar backup dos snippets: {e}"))?;
            fs::remove_file(&path)
                .map_err(|e| format!("Falha ao preparar atualização dos snippets: {e}"))?;
        }

        fs::rename(&temp_path, &path)
            .map_err(|e| format!("Falha ao finalizar gravação dos snippets: {e}"))
    }

    fn save_with_rollback(
        &self,
        previous_snippets: Option<Vec<Snippet>>,
        previous_categories: Option<Vec<Category>>,
    ) -> Result<(), String> {
        if let Err(error) = self.save_to_disk() {
            if let Some(previous) = previous_snippets {
                if let Ok(mut snippets) = self.snippets.lock() {
                    *snippets = previous;
                }
            }
            if let Some(previous) = previous_categories {
                if let Ok(mut categories) = self.categories.lock() {
                    *categories = previous;
                }
            }
            return Err(error);
        }
        Ok(())
    }

    fn validate_input(
        &self,
        input: SnippetInput,
        current_id: Option<&str>,
    ) -> Result<SnippetInput, String> {
        let input = Self::normalize_and_validate(input)?;
        if let Some(category_id) = input.category_id.as_deref() {
            let categories = self
                .categories
                .lock()
                .map_err(|_| "Falha ao bloquear categorias".to_string())?;
            if !categories.iter().any(|category| category.id == category_id) {
                return Err("Categoria selecionada não existe".to_string());
            }
        }

        let snippets = self
            .snippets
            .lock()
            .map_err(|_| "Falha ao bloquear armazenamento".to_string())?;
        if snippets.iter().any(|snippet| {
            Some(snippet.id.as_str()) != current_id
                && snippet.trigger.eq_ignore_ascii_case(&input.trigger)
        }) {
            return Err(format!(
                "Já existe um snippet com o gatilho '{}'",
                input.trigger
            ));
        }
        Ok(input)
    }

    fn prepare_new_category(
        &self,
        name: String,
        parent_id: Option<String>,
        icon: Option<CategoryIcon>,
    ) -> Result<Category, String> {
        let name = Self::normalize_category_name(&name)?;
        let parent_id = self.validate_category_parent("", parent_id.as_deref())?;
        let category_icon = Self::normalize_category_icon(icon)?;

        let categories = self
            .categories
            .lock()
            .map_err(|_| "Falha ao bloquear categorias".to_string())?;
        if categories.iter().any(|category| {
            category.parent_id == parent_id && category.name.eq_ignore_ascii_case(&name)
        }) {
            return Err(format!(
                "Já existe uma categoria irmã com o nome '{}'",
                name
            ));
        }

        let next_sort_index = categories
            .iter()
            .filter(|category| category.parent_id == parent_id)
            .map(|category| category.sort_index)
            .max()
            .unwrap_or(-1)
            + 1;
        let now = Utc::now().to_rfc3339();
        Ok(Category {
            id: Uuid::new_v4().to_string(),
            name,
            parent_id,
            icon: category_icon,
            sort_mode: CategorySortMode::Manual,
            sort_index: next_sort_index,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    fn validate_category_parent(
        &self,
        current_id: &str,
        parent_id: Option<&str>,
    ) -> Result<Option<String>, String> {
        let Some(parent_id) = parent_id else {
            return Ok(None);
        };

        let categories = self
            .categories
            .lock()
            .map_err(|_| "Falha ao bloquear categorias".to_string())?;
        if !categories.iter().any(|category| category.id == parent_id) {
            return Err("Categoria pai não existe".to_string());
        }

        if current_id.is_empty() {
            return Ok(Some(parent_id.to_string()));
        }

        if current_id == parent_id {
            return Err("Uma categoria não pode ser filha dela mesma".to_string());
        }

        let mut cursor = Some(parent_id.to_string());
        while let Some(candidate) = cursor {
            if candidate == current_id {
                return Err("Mover a categoria criaria um ciclo".to_string());
            }
            cursor = categories
                .iter()
                .find(|category| category.id == candidate)
                .and_then(|category| category.parent_id.clone());
        }

        Ok(Some(parent_id.to_string()))
    }

    fn normalize_and_validate(mut input: SnippetInput) -> Result<SnippetInput, String> {
        input.trigger = input.trigger.trim().to_string();
        input.name = input.name.trim().to_string();
        input.tags = input
            .tags
            .into_iter()
            .map(|tag| tag.trim().to_string())
            .filter(|tag| !tag.is_empty())
            .collect();
        input.tags.sort_by_key(|tag| tag.to_lowercase());
        input.tags.dedup_by(|a, b| a.eq_ignore_ascii_case(b));

        if input.trigger.is_empty() {
            return Err("O gatilho é obrigatório".to_string());
        }
        if input.trigger.chars().count() > MAX_TRIGGER_LEN {
            return Err(format!(
                "O gatilho deve ter até {MAX_TRIGGER_LEN} caracteres"
            ));
        }
        if input.trigger.chars().any(char::is_whitespace) {
            return Err("O gatilho não pode conter espaços".to_string());
        }
        if input.name.is_empty() {
            return Err("O nome é obrigatório".to_string());
        }
        if input.name.chars().count() > MAX_NAME_LEN {
            return Err(format!("O nome deve ter até {MAX_NAME_LEN} caracteres"));
        }
        if input.tags.len() > MAX_TAGS {
            return Err(format!("Use no máximo {MAX_TAGS} tags"));
        }
        if input
            .tags
            .iter()
            .any(|tag| tag.chars().count() > MAX_TAG_LEN)
        {
            return Err(format!("Cada tag deve ter até {MAX_TAG_LEN} caracteres"));
        }
        if input.actions.is_empty() {
            return Err("Adicione pelo menos uma ação ao snippet".to_string());
        }
        for action in &input.actions {
            match action {
                MacroAction::Text { value } if value.is_empty() => {
                    return Err("Ações de texto não podem estar vazias".to_string());
                }
                MacroAction::Key { key, .. } if key.trim().is_empty() => {
                    return Err("Ações de tecla precisam informar uma tecla".to_string());
                }
                MacroAction::Delay { milliseconds } if *milliseconds > 60_000 => {
                    return Err("A espera máxima por ação é de 60 segundos".to_string());
                }
                _ => {}
            }
        }
        Ok(input)
    }

    fn normalize_snippet(mut snippet: Snippet) -> Result<Snippet, String> {
        let input = SnippetInput {
            trigger: snippet.trigger,
            name: snippet.name,
            category_id: snippet.category_id.clone(),
            tags: snippet.tags,
            favorite: snippet.favorite,
            actions: snippet.actions,
        };
        let input = Self::normalize_and_validate(input)?;
        snippet.id = if snippet.id.trim().is_empty() {
            Uuid::new_v4().to_string()
        } else {
            snippet.id
        };
        snippet.trigger = input.trigger;
        snippet.name = input.name;
        snippet.category_id = input.category_id;
        snippet.tags = input.tags;
        snippet.favorite = input.favorite;
        snippet.actions = input.actions;
        if snippet.created_at.is_empty() {
            snippet.created_at = Utc::now().to_rfc3339();
        }
        if snippet.updated_at.is_empty() {
            snippet.updated_at = snippet.created_at.clone();
        }
        Ok(snippet)
    }

    fn normalize_category(mut category: Category) -> Result<Category, String> {
        category.name = Self::normalize_category_name(&category.name)?;
        category.icon = Self::normalize_category_icon(Some(category.icon))?;
        if category.id.trim().is_empty() {
            category.id = Uuid::new_v4().to_string();
        }
        if category.created_at.is_empty() {
            category.created_at = Utc::now().to_rfc3339();
        }
        if category.updated_at.is_empty() {
            category.updated_at = category.created_at.clone();
        }
        Ok(category)
    }

    fn normalize_category_name(name: &str) -> Result<String, String> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err("O nome da categoria é obrigatório".to_string());
        }
        if name.chars().count() > MAX_CATEGORY_NAME_LEN {
            return Err(format!(
                "A categoria deve ter até {MAX_CATEGORY_NAME_LEN} caracteres"
            ));
        }
        Ok(name)
    }

    fn normalize_category_icon(icon: Option<CategoryIcon>) -> Result<CategoryIcon, String> {
        let icon = icon.unwrap_or_default();
        let value = icon.value.trim().to_string();
        if value.is_empty() {
            return Err("O ícone da categoria é obrigatório".to_string());
        }
        Ok(CategoryIcon {
            kind: icon.kind,
            value,
        })
    }

    fn validate_library(snippets: &[Snippet], categories: &[Category]) -> Result<(), String> {
        let mut seen_ids = HashSet::new();
        let mut seen_triggers = HashSet::new();
        let category_ids: HashSet<&str> = categories.iter().map(|category| category.id.as_str()).collect();

        for snippet in snippets {
            if !seen_ids.insert(snippet.id.as_str()) {
                return Err(format!("O backup contém IDs duplicados: '{}'", snippet.id));
            }
            let normalized = snippet.trigger.to_lowercase();
            if !seen_triggers.insert(normalized.clone()) {
                return Err(format!(
                    "O backup contém gatilhos duplicados: '{}'",
                    snippet.trigger
                ));
            }
            if let Some(category_id) = snippet.category_id.as_deref() {
                if !category_ids.contains(category_id) {
                    return Err(format!(
                        "Snippet '{}' referencia categoria inexistente",
                        snippet.name
                    ));
                }
            }
        }

        let mut by_id = HashMap::new();
        for category in categories {
            if by_id.insert(category.id.as_str(), category).is_some() {
                return Err(format!(
                    "O backup contém IDs de categoria duplicados: '{}'",
                    category.id
                ));
            }
        }

        for category in categories {
            if let Some(parent_id) = category.parent_id.as_deref() {
                if !by_id.contains_key(parent_id) {
                    return Err(format!(
                        "Categoria '{}' referencia pai inexistente",
                        category.name
                    ));
                }
            }
        }

        for category in categories {
            let mut seen = HashSet::new();
            let mut cursor = category.parent_id.as_deref();
            while let Some(current) = cursor {
                if !seen.insert(current) {
                    return Err("A árvore de categorias contém um ciclo".to_string());
                }
                if current == category.id {
                    return Err("A árvore de categorias contém um ciclo".to_string());
                }
                cursor = by_id.get(current).and_then(|item| item.parent_id.as_deref());
            }
        }

        let mut sibling_names = HashSet::new();
        for category in categories {
            let key = (
                category.parent_id.clone().unwrap_or_default(),
                category.name.to_lowercase(),
            );
            if !sibling_names.insert(key) {
                return Err(format!(
                    "Existem categorias irmãs duplicadas com o nome '{}'",
                    category.name
                ));
            }
        }

        Ok(())
    }

    fn migrate_legacy_categories(
        mut snippets: Vec<Snippet>,
        mut categories: Vec<Category>,
    ) -> Result<(Vec<Snippet>, Vec<Category>, bool), String> {
        let mut migrated = false;
        let mut path_map = HashMap::<(Option<String>, String), String>::new();
        let mut next_sort = HashMap::<Option<String>, i64>::new();

        for category in &categories {
            path_map.insert(
                (category.parent_id.clone(), category.name.to_lowercase()),
                category.id.clone(),
            );
            next_sort
                .entry(category.parent_id.clone())
                .and_modify(|value| *value = (*value).max(category.sort_index + 1))
                .or_insert(category.sort_index + 1);
        }

        for snippet in &mut snippets {
            if snippet.category_id.is_some() {
                snippet.category.clear();
                continue;
            }

            let raw = snippet.category.replace('\\', "/");
            let segments = raw
                .split('/')
                .map(str::trim)
                .filter(|segment| !segment.is_empty())
                .collect::<Vec<_>>();
            if segments.is_empty() {
                snippet.category.clear();
                continue;
            }

            migrated = true;
            let mut parent_id = None::<String>;
            for segment in segments {
                let key = (parent_id.clone(), segment.to_lowercase());
                let category_id = if let Some(existing) = path_map.get(&key) {
                    existing.clone()
                } else {
                    let now = Utc::now().to_rfc3339();
                    let sort_index = next_sort.get(&parent_id).copied().unwrap_or(0);
                    let category = Category {
                        id: Uuid::new_v4().to_string(),
                        name: segment.to_string(),
                        parent_id: parent_id.clone(),
                        icon: CategoryIcon::default(),
                        sort_mode: CategorySortMode::Manual,
                        sort_index,
                        created_at: now.clone(),
                        updated_at: now,
                    };
                    next_sort.insert(parent_id.clone(), sort_index + 1);
                    path_map.insert(key, category.id.clone());
                    let id = category.id.clone();
                    categories.push(category);
                    id
                };
                parent_id = Some(category_id);
            }

            snippet.category_id = parent_id;
            snippet.category.clear();
        }

        Self::validate_library(&snippets, &categories)?;
        Ok((snippets, categories, migrated))
    }

    fn from_legacy_snippet(snippet: LegacySnippet) -> Snippet {
        Snippet {
            id: if snippet.id.trim().is_empty() {
                Uuid::new_v4().to_string()
            } else {
                snippet.id
            },
            trigger: snippet.trigger,
            name: snippet.name,
            category_id: None,
            category: snippet.category,
            tags: snippet.tags,
            favorite: snippet.favorite,
            actions: snippet.actions,
            created_at: if snippet.created_at.is_empty() {
                Utc::now().to_rfc3339()
            } else {
                snippet.created_at
            },
            updated_at: if snippet.updated_at.is_empty() {
                Utc::now().to_rfc3339()
            } else {
                snippet.updated_at
            },
            usage_count: snippet.usage_count,
            last_used_at: snippet.last_used_at,
        }
    }

    fn category_paths(categories: &[Category]) -> HashMap<String, (String, String)> {
        let by_id: HashMap<&str, &Category> =
            categories.iter().map(|category| (category.id.as_str(), category)).collect();
        let mut paths = HashMap::new();
        for category in categories {
            let mut names = vec![category.name.clone()];
            let mut cursor = category.parent_id.as_deref();
            while let Some(parent_id) = cursor {
                if let Some(parent) = by_id.get(parent_id) {
                    names.push(parent.name.clone());
                    cursor = parent.parent_id.as_deref();
                } else {
                    break;
                }
            }
            names.reverse();
            paths.insert(
                category.id.clone(),
                (category.name.clone(), names.join(" / ")),
            );
        }
        paths
    }

    fn snippet_view_from(
        snippet: Snippet,
        paths: &HashMap<String, (String, String)>,
    ) -> SnippetView {
        let (category_name, category_path) = snippet
            .category_id
            .as_ref()
            .and_then(|id| paths.get(id))
            .cloned()
            .unwrap_or_else(|| (String::new(), String::new()));
        SnippetView {
            id: snippet.id,
            trigger: snippet.trigger,
            name: snippet.name,
            category_id: snippet.category_id,
            category_name,
            category_path,
            tags: snippet.tags,
            favorite: snippet.favorite,
            actions: snippet.actions,
            created_at: snippet.created_at,
            updated_at: snippet.updated_at,
            usage_count: snippet.usage_count,
            last_used_at: snippet.last_used_at,
        }
    }

    fn unique_trigger(&self, base: &str) -> Result<String, String> {
        let snippets = self
            .snippets
            .lock()
            .map_err(|_| "Falha ao bloquear armazenamento".to_string())?;
        Ok(Self::unique_trigger_in(&snippets, base))
    }

    fn unique_trigger_in(snippets: &[Snippet], base: &str) -> String {
        if !snippets
            .iter()
            .any(|snippet| snippet.trigger.eq_ignore_ascii_case(base))
        {
            return base.to_string();
        }
        for suffix in 2.. {
            let candidate = format!("{base}-{suffix}");
            if !snippets
                .iter()
                .any(|snippet| snippet.trigger.eq_ignore_ascii_case(&candidate))
            {
                return candidate;
            }
        }
        unreachable!()
    }

    fn unique_category_name_in(
        categories: &[Category],
        parent_id: Option<&str>,
        base: &str,
    ) -> String {
        if !categories.iter().any(|category| {
            category.parent_id.as_deref() == parent_id && category.name.eq_ignore_ascii_case(base)
        }) {
            return base.to_string();
        }
        for suffix in 2.. {
            let candidate = format!("{base} {suffix}");
            if !categories.iter().any(|category| {
                category.parent_id.as_deref() == parent_id
                    && category.name.eq_ignore_ascii_case(&candidate)
            }) {
                return candidate;
            }
        }
        unreachable!()
    }

    fn category_depth(category: &Category) -> usize {
        category.parent_id.as_ref().map(|_| 1).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(trigger: &str) -> SnippetInput {
        SnippetInput {
            trigger: trigger.to_string(),
            name: "Teste".to_string(),
            category_id: None,
            tags: vec![" trabalho ".to_string(), "Trabalho".to_string()],
            favorite: false,
            actions: vec![MacroAction::Text {
                value: "conteúdo".to_string(),
            }],
        }
    }

    fn store() -> (SnippetStore, PathBuf) {
        let path = std::env::temp_dir().join(format!("guepardosys-snip-test-{}", Uuid::new_v4()));
        let store = SnippetStore::new();
        store.init(path.clone()).unwrap();
        (store, path)
    }

    #[test]
    fn rejects_duplicate_triggers_case_insensitively() {
        let (store, path) = store();
        store.add(input("/Email")).unwrap();
        assert!(store.add(input("/email")).is_err());
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn persists_versioned_data_and_normalizes_tags() {
        let (store, path) = store();
        let snippet = store.add(input("/teste")).unwrap();
        assert_eq!(snippet.tags, vec!["trabalho"]);
        let content = fs::read_to_string(path.join("snippets.json")).unwrap();
        assert!(content.contains("\"version\": 2"));
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn migrates_legacy_nested_categories() {
        let legacy = serde_json::json!([
            {
                "id": "1",
                "trigger": "/a",
                "name": "A",
                "category": "Trabalho/Clientes/Acme",
                "tags": [],
                "favorite": false,
                "actions": [{"type":"text","value":"ok"}],
                "created_at": "2024-01-01T00:00:00Z"
            }
        ]);
        let data = SnippetStore::read_store_content(&legacy.to_string()).unwrap();
        assert_eq!(data.categories.len(), 3);
        assert!(data.snippets[0].category_id.is_some());
    }

    #[test]
    fn exports_categories_and_icons() {
        let (store, path) = store();
        let category = store
            .create_category(
                "Projetos".to_string(),
                None,
                Some(CategoryIcon {
                    kind: CategoryIconKind::Emoji,
                    value: "📁".to_string(),
                }),
            )
            .unwrap();
        let mut snippet = input("/teste");
        snippet.category_id = Some(category.id);
        store.add(snippet).unwrap();
        let content = store.export_json().unwrap();
        assert!(content.contains("\"categories\""));
        assert!(content.contains("📁"));
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn prevents_deleting_non_empty_category() {
        let (store, path) = store();
        let category = store.create_category("Projetos".to_string(), None, None).unwrap();
        let mut snippet = input("/teste");
        snippet.category_id = Some(category.id.clone());
        store.add(snippet).unwrap();
        assert!(store.delete_category(&category.id).is_err());
        let _ = fs::remove_dir_all(path);
    }
}
