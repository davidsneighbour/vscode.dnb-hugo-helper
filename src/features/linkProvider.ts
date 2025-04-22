import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Registers a DocumentLinkProvider for the extension.
 * @param context - The extension context.
 * @param config - The workspace configuration.
 * @param outputChannel - The output channel for logging.
 * @param debugLog - The debug logging function.
 * @param extensionDir - The root directory of the extension.
 */
export function registerLinkProvider(
  context: vscode.ExtensionContext,
  config: vscode.WorkspaceConfiguration,
  outputChannel: vscode.OutputChannel,
  debugLog: (...args: any[]) => void,
  extensionDir: string,
) {
  // Example: Use extensionDir to resolve paths
  const patterns = config
    .get<{ regex: string; folder: string }[]>('patterns', [])
    .map((pattern) => ({
      regex: new RegExp(pattern.regex),
      folder: path.resolve(extensionDir, pattern.folder),
    }));

  const provider = new (class implements vscode.DocumentLinkProvider {
    provideDocumentLinks(
      document: vscode.TextDocument,
      _token: vscode.CancellationToken,
    ): vscode.ProviderResult<vscode.DocumentLink[]> {
      const text = document.getText();
      const links: vscode.DocumentLink[] = [];

      for (const { regex, folder } of patterns) {
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text))) {
          const capture = match[1];
          if (!capture) continue;

          const start = document.positionAt(
            match.index + match[0].indexOf(capture),
          );
          const end = start.translate(0, capture.length);
          const targetPath = path.join(folder, capture);
          const targetUri = vscode.Uri.file(targetPath);

          links.push(
            new vscode.DocumentLink(new vscode.Range(start, end), targetUri),
          );
        }
      }

      debugLog('DocumentLinkProvider registered.');

      return links;
    }
  })();

  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider({ scheme: 'file' }, provider),
  );

  debugLog('DocumentLinkProvider registered.');
}
