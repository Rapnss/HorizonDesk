import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('Horizon Desk Builder is now active.');

    let runPlugin = vscode.commands.registerCommand('horizondesk.runPlugin', () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a plugin directory first.');
            return;
        }

        const terminal = vscode.window.createTerminal('Horizon Workshop');
        terminal.show();
        
        vscode.window.showInformationMessage('Launching Horizon Desk Workshop...');
        
        // Execute the SDK run command
        terminal.sendText(`horizondesk-sdk run .`);
    });

    let installPlugin = vscode.commands.registerCommand('horizondesk.installPlugin', () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a plugin directory first.');
            return;
        }

        const terminal = vscode.window.createTerminal('Horizon SDK');
        terminal.show();
        
        vscode.window.showInformationMessage('Installing plugin locally...');
        
        // Execute the SDK install command
        terminal.sendText(`horizondesk-sdk install`);
    });

    context.subscriptions.push(runPlugin);
    context.subscriptions.push(installPlugin);
}

export function deactivate() {}
