use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use uuid::Uuid;

const STORE_VERSION: u32 = 1;
const MAX_TRIGGER_LEN: usize = 100;
const MAX_NAME_LEN: usize = 200;
const MAX_CATEGORY_LEN: usize = 100;
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub trigger: String,
    pub name: String,
    #[serde(default)]
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
pub struct SnippetInput {
    pub trigger: String,
    pub name: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub favorite: bool,
    pub actions: Vec<MacroAction>,
}

#[derive(Debug, Serialize, Deserialize)]
struct StoreFile {
    version: u32,
    snippets: Vec<Snippet>,
}

pub struct SnippetStore {
    snippets: Mutex<Vec<Snippet>>,
    file_path: Mutex<PathBuf>,
}

impl SnippetStore {
    pub fn new() -> Self {
        Self {
            snippets: Mutex::new(Vec::new()),
            file_path: Mutex::new(PathBuf::new()),
        }
    }

    pub fn init(&self, app_data_dir: PathBuf) -> Result<(), String> {
        let file_path = app_data_dir.join("snippets.json");
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Falha ao criar diretório de dados: {e}"))?;

        let snippets = if file_path.exists() {
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
            Vec::new()
        };

        *self
            .snippets
            .lock()
            .map_err(|_| "Falha ao bloquear armazenamento".to_string())? = snippets;
        *self
            .file_path
            .lock()
            .map_err(|_| "Falha ao bloquear caminho do armazenamento".to_string())? = file_path;
        Ok(())
    }

    fn read_store(path: &Path) -> Result<Vec<Snippet>, String> {
        let content =
            fs::read_to_string(path).map_err(|e| format!("Falha ao ler snippets: {e}"))?;

        if let Ok(store) = serde_json::from_str::<StoreFile>(&content) {
            return Ok(store.snippets);
        }

        // Migration path for the original unversioned Vec<Snippet> format.
        serde_json::from_str::<Vec<Snippet>>(&content)
            .map_err(|e| format!("Arquivo de snippets inválido: {e}"))
    }

    fn save_to_disk(&self) -> Result<(), String> {
        let snippets = self
            .snippets
            .lock()
            .map_err(|_| "Falha ao bloquear armazenamento".to_string())?
            .clone();
        let path = self
            .file_path
            .lock()
            .map_err(|_| "Falha ao bloquear caminho do armazenamento".to_string())?
            .clone();

        if path.as_os_str().is_empty() {
            return Err("Armazenamento ainda não foi inicializado".to_string());
        }

        let data = StoreFile {
            version: STORE_VERSION,
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

    fn save_with_rollback(&self, previous: Vec<Snippet>) -> Result<(), String> {
        if let Err(error) = self.save_to_disk() {
            if let Ok(mut snippets) = self.snippets.lock() {
                *snippets = previous;
            }
            return Err(error);
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
            category: input.category,
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
        self.save_with_rollback(previous)?;
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
            snippet.category = input.category;
            snippet.tags = input.tags;
            snippet.favorite = input.favorite;
            snippet.actions = input.actions;
            snippet.updated_at = Utc::now().to_rfc3339();
            (snippet.clone(), previous)
        };
        self.save_with_rollback(previous)?;
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
            self.save_with_rollback(previous)?;
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
            category: source.category,
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
        self.save_with_rollback(previous)?;
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
        self.save_with_rollback(previous)
    }

    pub fn export_json(&self) -> Result<String, String> {
        let data = StoreFile {
            version: STORE_VERSION,
            snippets: self.get_all()?,
        };
        serde_json::to_string_pretty(&data).map_err(|e| format!("Falha ao exportar snippets: {e}"))
    }

    pub fn import_json(&self, content: &str, replace: bool) -> Result<usize, String> {
        let incoming = if let Ok(store) = serde_json::from_str::<StoreFile>(content) {
            store.snippets
        } else {
            serde_json::from_str::<Vec<Snippet>>(content)
                .map_err(|e| format!("Arquivo de importação inválido: {e}"))?
        };

        let mut normalized = Vec::with_capacity(incoming.len());
        for snippet in incoming {
            let input = SnippetInput {
                trigger: snippet.trigger,
                name: snippet.name,
                category: snippet.category,
                tags: snippet.tags,
                favorite: snippet.favorite,
                actions: snippet.actions,
            };
            let input = Self::normalize_and_validate(input)?;
            normalized.push(Snippet {
                id: if snippet.id.trim().is_empty() {
                    Uuid::new_v4().to_string()
                } else {
                    snippet.id
                },
                trigger: input.trigger,
                name: input.name,
                category: input.category,
                tags: input.tags,
                favorite: input.favorite,
                actions: input.actions,
                created_at: if snippet.created_at.is_empty() {
                    Utc::now().to_rfc3339()
                } else {
                    snippet.created_at
                },
                updated_at: Utc::now().to_rfc3339(),
                usage_count: snippet.usage_count,
                last_used_at: snippet.last_used_at,
            });
        }

        let imported_count = normalized.len();
        let previous = {
            let mut snippets = self
                .snippets
                .lock()
                .map_err(|_| "Falha ao bloquear armazenamento".to_string())?;
            let previous = snippets.clone();
            if replace {
                let mut seen_triggers = Vec::<String>::new();
                let mut seen_ids = Vec::<String>::new();
                for snippet in &normalized {
                    if seen_triggers
                        .iter()
                        .any(|trigger| trigger.eq_ignore_ascii_case(&snippet.trigger))
                    {
                        return Err(format!(
                            "O backup contém gatilhos duplicados: '{}'",
                            snippet.trigger
                        ));
                    }
                    if seen_ids.contains(&snippet.id) {
                        return Err(format!("O backup contém IDs duplicados: '{}'", snippet.id));
                    }
                    seen_triggers.push(snippet.trigger.clone());
                    seen_ids.push(snippet.id.clone());
                }
                *snippets = normalized;
            } else {
                for mut snippet in normalized {
                    if snippets.iter().any(|item| {
                        item.trigger.eq_ignore_ascii_case(&snippet.trigger) || item.id == snippet.id
                    }) {
                        snippet.id = Uuid::new_v4().to_string();
                        snippet.trigger = Self::unique_trigger_in(
                            &snippets,
                            &format!("{}-importado", snippet.trigger),
                        );
                    }
                    snippets.push(snippet);
                }
            }
            previous
        };
        self.save_with_rollback(previous)?;
        Ok(imported_count)
    }

    fn validate_input(
        &self,
        input: SnippetInput,
        current_id: Option<&str>,
    ) -> Result<SnippetInput, String> {
        let input = Self::normalize_and_validate(input)?;
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

    fn normalize_and_validate(mut input: SnippetInput) -> Result<SnippetInput, String> {
        input.trigger = input.trigger.trim().to_string();
        input.name = input.name.trim().to_string();
        input.category = input.category.trim().to_string();
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
        if input.category.chars().count() > MAX_CATEGORY_LEN {
            return Err(format!(
                "A categoria deve ter até {MAX_CATEGORY_LEN} caracteres"
            ));
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
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(trigger: &str) -> SnippetInput {
        SnippetInput {
            trigger: trigger.to_string(),
            name: "Teste".to_string(),
            category: "Geral".to_string(),
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
        assert!(content.contains("\"version\": 1"));
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn duplicates_with_unique_trigger() {
        let (store, path) = store();
        let original = store.add(input("/teste")).unwrap();
        let duplicate = store.duplicate(&original.id).unwrap();
        assert_eq!(duplicate.trigger, "/teste-copia");
        assert_ne!(duplicate.id, original.id);
        let _ = fs::remove_dir_all(path);
    }
}
