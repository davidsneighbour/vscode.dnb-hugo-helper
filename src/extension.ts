import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { registerLinkProvider } from './features/linkProvider';
import { registerSnippetsProvider } from './features/snippetsProvider';

let debug = false;
let outputChannel: vscode.OutputChannel;

/** Logs messages to the output channel when dnbHugoHelper.debug = true */
const debugLog = (...args: any[]) => {
  if (debug) {
    const message = args.map(String).join(' ');
    outputChannel.appendLine(message);
  }
};

/**
 * Activate the extension: load settings and register the DocumentLinkProvider
 * for each configured language.
 */
export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('dnbHugoHelper');
  debug = config.get<boolean>('debug', false);

  // Create the output channel
  outputChannel = vscode.window.createOutputChannel('DNB Hugo Helper');
  outputChannel.appendLine('🔗 DNB Hugo Helper activated.');

  debugLog('🔗 GoHugo Partial Linker activating…');

  // Resolve paths relative to the extension directory
  const extensionDir = context.extensionPath;

  // Register features
  registerLinkProvider(context, config, outputChannel, debugLog, extensionDir);
  registerSnippetsProvider(
    context,
    config,
    outputChannel,
    debugLog,
    extensionDir,
  );

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
 * group into a DocumentLink pointing at extensionDir/folder/captured.
 */
export class PartialLinkProvider implements vscode.DocumentLinkProvider {
  constructor(
    private readonly patterns: { regex: RegExp; folder: string }[],
    private readonly extensionDir: string,
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
        const targetFsPath = path.join(this.extensionDir, folder, cap);
        const targetUri = vscode.Uri.file(targetFsPath);

        links.push(
          new vscode.DocumentLink(new vscode.Range(start, end), targetUri),
        );
      }
    }

    return links;
  }
}
