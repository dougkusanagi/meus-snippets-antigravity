use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub trigger: String,
    pub name: String,
    pub actions: Vec<MacroAction>,
    pub created_at: String,
}

pub struct SnippetStore {
    snippets: Mutex<Vec<Snippet>>,
    file_path: Mutex<PathBuf>,
}

impl SnippetStore {
    pub fn new() -> Self {
        SnippetStore {
            snippets: Mutex::new(Vec::new()),
            file_path: Mutex::new(PathBuf::new()),
        }
    }

    pub fn init(&self, app_data_dir: PathBuf) {
        let file_path = app_data_dir.join("snippets.json");

        // Ensure the directory exists
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).ok();
        }

        // Load existing snippets if file exists
        if file_path.exists() {
            if let Ok(content) = fs::read_to_string(&file_path) {
                if let Ok(snippets) = serde_json::from_str::<Vec<Snippet>>(&content) {
                    let mut store = self.snippets.lock().unwrap();
                    *store = snippets;
                }
            }
        }

        let mut path = self.file_path.lock().unwrap();
        *path = file_path;
    }

    fn save_to_disk(&self) {
        let snippets = self.snippets.lock().unwrap();
        let path = self.file_path.lock().unwrap();
        if let Ok(json) = serde_json::to_string_pretty(&*snippets) {
            fs::write(&*path, json).ok();
        }
    }

    pub fn get_all(&self) -> Vec<Snippet> {
        let snippets = self.snippets.lock().unwrap();
        snippets.clone()
    }

    pub fn get_by_id(&self, id: &str) -> Option<Snippet> {
        let snippets = self.snippets.lock().unwrap();
        snippets.iter().find(|s| s.id == id).cloned()
    }

    pub fn add(&self, trigger: String, name: String, actions: Vec<MacroAction>) -> Snippet {
        let snippet = Snippet {
            id: Uuid::new_v4().to_string(),
            trigger,
            name,
            actions,
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        {
            let mut snippets = self.snippets.lock().unwrap();
            snippets.push(snippet.clone());
        }

        self.save_to_disk();
        snippet
    }

    pub fn update(
        &self,
        id: &str,
        trigger: String,
        name: String,
        actions: Vec<MacroAction>,
    ) -> Option<Snippet> {
        let mut snippets = self.snippets.lock().unwrap();
        if let Some(snippet) = snippets.iter_mut().find(|s| s.id == id) {
            snippet.trigger = trigger;
            snippet.name = name;
            snippet.actions = actions;
            let updated = snippet.clone();
            drop(snippets);
            self.save_to_disk();
            Some(updated)
        } else {
            None
        }
    }

    pub fn delete(&self, id: &str) -> bool {
        let mut snippets = self.snippets.lock().unwrap();
        let len_before = snippets.len();
        snippets.retain(|s| s.id != id);
        let deleted = snippets.len() < len_before;
        drop(snippets);
        if deleted {
            self.save_to_disk();
        }
        deleted
    }

    #[allow(dead_code)]
    pub fn find_by_trigger(&self, trigger: &str) -> Vec<Snippet> {
        let snippets = self.snippets.lock().unwrap();
        snippets
            .iter()
            .filter(|s| s.trigger.starts_with(trigger) || s.name.to_lowercase().contains(&trigger.to_lowercase()))
            .cloned()
            .collect()
    }
}
