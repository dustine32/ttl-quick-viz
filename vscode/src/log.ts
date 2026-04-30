import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function getLog(): vscode.OutputChannel {
  if (!channel) channel = vscode.window.createOutputChannel('TTL Quick Viz');
  return channel;
}
