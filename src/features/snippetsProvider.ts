import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Registers a SnippetsProvider for the extension.
 * @param context - The extension context.
 * @param config - The workspace configuration.
 * @param outputChannel - The output channel for logging.
 * @param debugLog - The debug logging function.
 * @param extensionDir - The root directory of the extension.
 */
export function registerSnippetsProvider(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration,
  outputChannel: vscode.OutputChannel,
  debugLog: (...args: any[]) => void,
  extensionDir: string,
) {
  const langs = config.get<string[]>('snippetLanguages', ['gohtml']);
  const snippetFile = path.join(
    context.extensionPath,
    'snippets',
    'gohtml-linker.code-snippets.json',
  );

  let snippets: Record<
    string,
    { prefix: string; body: string | string[]; description?: string }
  >;
  try {
    snippets = JSON.parse(fs.readFileSync(snippetFile, 'utf8'));
  } catch (e) {
    vscode.window.showErrorMessage('Could not load GoHugo snippets: ' + e);
    return;
  }

  const items = Object.entries(snippets).map(([name, def]) => {
    const item = new vscode.CompletionItem(
      def.prefix,
      vscode.CompletionItemKind.Snippet,
    );
    const bodyText = Array.isArray(def.body) ? def.body.join('\n') : def.body;
    item.insertText = new vscode.SnippetString(bodyText);
    item.detail = name;
    if (def.description) {
      item.documentation = new vscode.MarkdownString(def.description);
    }
    return item;
  });

  langs.forEach((lang) => {
    const selector: vscode.DocumentSelector = {
      scheme: 'file',
      language: lang,
    };
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(selector, {
        provideCompletionItems() {
          return items;
        },
      }),
    );
  });

  // Example: Use extensionDir if needed for resolving snippet paths
  const snippetsPath = path.resolve(extensionDir, 'snippets');

  debugLog(`SnippetsProvider initialized with path: ${snippetsPath}`);
}
