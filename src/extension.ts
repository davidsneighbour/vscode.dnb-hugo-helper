import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let debug = false;
let outputChannel: vscode.OutputChannel;

/** Logs messages to the output channel when gohtmlLinker.debug = true */
const debugLog = (...args: any[]) => {
  if (debug) {
    const message = args.map(String).join(' ');
    outputChannel.appendLine(message);
  }
};

interface SnippetDef {
  prefix: string;
  body: string | string[];
  description?: string;
}

/**
 * Activate the extension: load settings and register the DocumentLinkProvider
 * for each configured language.
 */

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('gohtmlLinker');
  debug = config.get<boolean>('debug', false);

  // Create the output channel
  outputChannel = vscode.window.createOutputChannel('DNB Hugo Helper');
  outputChannel.appendLine('🔗 DNB Hugo Helper activated.');

  debugLog('🔗 GoHugo Partial Linker activating…');

  const rawPatterns = config.get<any[]>('patterns', []);
  const languages = config.get<string[]>('languages', []);

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      'GoHugo Partial Linker: no workspace folder open.',
    );
    return;
  }
  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Build regex list, skip invalid entries
  const patterns: { regex: RegExp; folder: string }[] = [];
  for (const p of rawPatterns) {
    try {
      const re = new RegExp(p.regex, 'g');
      patterns.push({ regex: re, folder: p.folder });
      debugLog(`✔️ Loaded pattern /${p.regex}/ => ${p.folder}`);
    } catch (e) {
      outputChannel.appendLine(
        `❌ Invalid regex in gohtmlLinker.patterns: ${p.regex}`,
      );
      console.error(e);
    }
  }

  const provider = new PartialLinkProvider(patterns, workspaceRoot);
  for (const lang of languages) {
    debugLog(`🛠️ Registering DocumentLinkProvider for language "${lang}"`);
    const selector: vscode.DocumentSelector = {
      scheme: 'file',
      language: lang,
    };
    context.subscriptions.push(
      vscode.languages.registerDocumentLinkProvider(selector, provider),
    );
  }

  // code snippets
  const cfg = vscode.workspace.getConfiguration('gohtmlLinker');
  const langs = cfg.get<string[]>('snippetLanguages', ['gohtml']);
  const snippetFile = path.join(
    context.extensionPath,
    'snippets',
    'gohtml-linker.code-snippets.json',
  );

  let snippets: Record<string, SnippetDef>;
  try {
    snippets = JSON.parse(fs.readFileSync(snippetFile, 'utf8'));
  } catch (e) {
    vscode.window.showErrorMessage('Could not load GoHugo snippets: ' + e);
    return;
  }

  // Build an array of CompletionItems
  const items = Object.entries(snippets).map(([name, def]) => {
    const item = new vscode.CompletionItem(
      def.prefix,
      vscode.CompletionItemKind.Snippet,
    );
    // if body is array, join with newline
    const bodyText = Array.isArray(def.body) ? def.body.join('\n') : def.body;
    item.insertText = new vscode.SnippetString(bodyText);
    item.detail = name;
    if (def.description) {
      item.documentation = new vscode.MarkdownString(def.description);
    }
    return item;
  });

  // Register a provider for each language
  langs.forEach((lang) => {
    const selector: vscode.DocumentSelector = {
      scheme: 'file',
      language: lang,
    };
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        selector,
        {
          provideCompletionItems(
            document: vscode.TextDocument,
            position: vscode.Position,
          ) {
            // Only trigger on word-chars; adapt triggerChars if needed
            return items;
          },
        },
        // you can specify trigger characters, e.g. '{', '$', etc., or omit for manual invocation
      ),
    );
  });

  debugLog('🔗 GoHugo Partial Linker activated.');
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.appendLine('🔗 DNB Hugo Helper deactivated.');
    outputChannel.dispose();
  }
}

/**
 * Scans documents for each configured regex and turns the first capture
 * group into a DocumentLink pointing at workspaceRoot/folder/captured.
 */
export class PartialLinkProvider implements vscode.DocumentLinkProvider {
  constructor(
    private readonly patterns: { regex: RegExp; folder: string }[],
    private readonly workspaceRoot: string,
  ) {}

  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.DocumentLink[]> {
    const text = document.getText();
    const links: vscode.DocumentLink[] = [];

    for (const { regex, folder } of this.patterns) {
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text))) {
        const cap = m[1];
        if (!cap) continue;

        const start = document.positionAt(m.index + m[0].indexOf(cap));
        const end = start.translate(0, cap.length);
        const targetFsPath = path.join(this.workspaceRoot, folder, cap);
        const targetUri = vscode.Uri.file(targetFsPath);

        links.push(
          new vscode.DocumentLink(new vscode.Range(start, end), targetUri),
        );
      }
    }

    return links;
  }
}
