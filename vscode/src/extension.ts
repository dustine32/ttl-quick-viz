import * as vscode from 'vscode';
import { TtlGraphEditorProvider } from './editor/ttlGraphEditorProvider';
import { getLog } from './log';

export function activate(context: vscode.ExtensionContext): void {
  const log = getLog();
  log.appendLine('[extension] activate()');
  context.subscriptions.push(log);

  try {
    context.subscriptions.push(TtlGraphEditorProvider.register(context));
    log.appendLine('[extension] custom editor registered: ' + TtlGraphEditorProvider.viewType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.appendLine('[extension] customEditor registration FAILED: ' + msg);
    void vscode.window.showErrorMessage('TTL Quick Viz: failed to register custom editor — ' + msg);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('ttlQuickViz.openGraph', async (uri?: vscode.Uri) => {
      log.show(true);
      log.appendLine('[command] openGraph invoked, uri=' + (uri ? uri.toString() : '(none)'));
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target) {
        log.appendLine('[command] no target uri — showing warning');
        void vscode.window.showWarningMessage('TTL Quick Viz: no .ttl file selected.');
        return;
      }
      log.appendLine('[command] target=' + target.fsPath);
      try {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          target,
          TtlGraphEditorProvider.viewType,
        );
        log.appendLine('[command] vscode.openWith returned');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.appendLine('[command] vscode.openWith FAILED: ' + msg);
        void vscode.window.showErrorMessage('TTL Quick Viz: ' + msg);
      }
    })
  );
}

export function deactivate(): void {
  // no-op
}
