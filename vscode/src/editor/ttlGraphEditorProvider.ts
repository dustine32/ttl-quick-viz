import * as vscode from 'vscode';
import { convert } from '../conversion';
import type { Graph } from '../conversion/types';
import { getLog } from '../log';
import { loadWebviewAssets, renderMissingBundleHtml, renderWebviewHtml } from './webviewHtml';

const REBUILD_DEBOUNCE_MS = 300;

const log = getLog();

type HostToWebview =
  | { type: 'graph/load'; graph: Graph; ttlText: string; fileName: string }
  | { type: 'graph/error'; message: string; fileName: string };

type WebviewToHost =
  | { type: 'webview/ready' }
  | { type: 'webview/log'; message: string }
  | { type: 'webview/error'; message: string; source?: string; line?: number; col?: number; stack?: string | null }
  | { type: 'reveal/line'; line: number };

export class TtlGraphEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'ttlQuickViz.graph';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new TtlGraphEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(TtlGraphEditorProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    });
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): void {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    };

    const fileName = baseName(document.fileName);
    log.show(true);
    log.appendLine('[host] resolveCustomTextEditor: ' + fileName);
    const assets = loadWebviewAssets(this.context, webviewPanel.webview);
    if (!assets) {
      log.appendLine('[host] webview bundle missing — showing fallback HTML');
      webviewPanel.webview.html = renderMissingBundleHtml(webviewPanel.webview, fileName);
      return;
    }
    log.appendLine('[host] script: ' + assets.scriptUri.toString());
    for (const css of assets.cssUris) log.appendLine('[host] css: ' + css.toString());
    webviewPanel.webview.html = renderWebviewHtml(webviewPanel.webview, assets, fileName);

    let webviewReady = false;
    let pending: HostToWebview | undefined;

    const post = (msg: HostToWebview): void => {
      if (webviewReady) {
        void webviewPanel.webview.postMessage(msg);
      } else {
        pending = msg;
      }
    };

    const sendCurrent = (): void => {
      const text = document.getText();
      const name = baseName(document.fileName);
      try {
        const graph = convert(text);
        log.appendLine('[host] converted ' + name + ': ' + graph.nodes.length + ' nodes, ' + graph.edges.length + ' edges');
        post({ type: 'graph/load', graph, ttlText: text, fileName: name });
      } catch (err) {
        log.appendLine('[host] convert FAILED: ' + (err instanceof Error ? err.message : String(err)));
        post({
          type: 'graph/error',
          message: err instanceof Error ? err.message : String(err),
          fileName: name,
        });
      }
    };

    let debounce: NodeJS.Timeout | undefined;
    const scheduleRebuild = (): void => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = undefined;
        sendCurrent();
      }, REBUILD_DEBOUNCE_MS);
    };

    const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return;
      scheduleRebuild();
    });

    const messageSub = webviewPanel.webview.onDidReceiveMessage((msg: WebviewToHost) => {
      if (msg.type === 'webview/log') {
        log.appendLine('[webview] ' + msg.message);
        return;
      }
      if (msg.type === 'webview/error') {
        log.appendLine('[webview ERROR] ' + msg.message + (msg.source ? ' @ ' + msg.source + ':' + msg.line + ':' + msg.col : ''));
        if (msg.stack) log.appendLine(msg.stack);
        return;
      }
      log.appendLine('[host] <- webview: ' + (msg && (msg as { type?: string }).type));
      if (msg.type === 'webview/ready') {
        webviewReady = true;
        if (pending) {
          void webviewPanel.webview.postMessage(pending);
          pending = undefined;
        } else {
          sendCurrent();
        }
        return;
      }
      if (msg.type === 'reveal/line') {
        void revealLine(document.uri, msg.line);
      }
    });

    setTimeout(() => {
      if (!webviewReady) {
        log.appendLine('[host] WARNING: no webview/ready after 5s — bundle likely failed to load. Open the webview devtools.');
      }
    }, 5000);

    webviewPanel.onDidDispose(() => {
      if (debounce) clearTimeout(debounce);
      changeSub.dispose();
      messageSub.dispose();
    });

    sendCurrent();
  }
}

function baseName(fsPath: string): string {
  const parts = fsPath.split(/[\\/]/);
  return parts[parts.length - 1] ?? fsPath;
}

async function revealLine(uri: vscode.Uri, line: number): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });
  const range = editor.document.lineAt(Math.max(0, line)).range;
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}
