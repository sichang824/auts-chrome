// Userscript metadata parser

export interface UserscriptMeta {
  matches: string[];
  excludes: string[];
  grants?: string[];
  requires?: string[];
  name?: string;
  version?: string;
  description?: string;
  author?: string;
}

/**
 * Parse the UserScript metadata block from code.
 * Returns commonly used fields; unknown keys are ignored for now.
 */
export function parseUserScriptMeta(code: string): UserscriptMeta {
  try {
    const blockMatch = code.match(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==/);
    const block = blockMatch ? blockMatch[0] : "";
    if (!block) return { matches: [], excludes: [] };

    const matches: string[] = [];
    const excludes: string[] = [];
    const grants: string[] = [];
    const requires: string[] = [];
    let name: string | undefined;
    let version: string | undefined;
    let description: string | undefined;
    let author: string | undefined;

    const lines = block.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      // Key-value lines, e.g., // @name  Foo
      const kv = line.match(/^\/\/\s*@([a-zA-Z0-9_-]+)\s+(.+?)\s*$/);
      if (!kv) continue;
      const key = kv[1].toLowerCase();
      const value = kv[2];

      switch (key) {
        case "match":
          matches.push(value);
          break;
        case "exclude":
        case "exclude-match":
          excludes.push(value);
          break;
        case "grant":
          grants.push(value);
          break;
        case "require":
          requires.push(value);
          break;
        case "name":
          name = value;
          break;
        case "version":
          version = value;
          break;
        case "description":
          description = value;
          break;
        case "author":
          author = value;
          break;
      }
    }

    return { matches, excludes, grants, requires, name, version, description, author };
  } catch {
    return { matches: [], excludes: [] };
  }
}


