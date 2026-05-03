import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Get the configured or auto-detected Scene Builder path
 */
function getSceneBuilderPath(): string | undefined {
    const config = vscode.workspace.getConfiguration('tlcsdm.javafxSupport');
    const configuredPath = config.get<string>('sceneBuilderPath');

    if (configuredPath && configuredPath.trim() !== '') {
        return configuredPath;
    }

    // Auto-detect Scene Builder installation
    return detectSceneBuilder();
}

/**
 * Try to auto-detect Scene Builder installation
 */
function detectSceneBuilder(): string | undefined {
    const platform = process.platform;
    const candidates: string[] = [];

    if (platform === 'win32') {
        candidates.push(
            'C:\\Program Files\\SceneBuilder\\SceneBuilder.exe',
            'C:\\Program Files (x86)\\SceneBuilder\\SceneBuilder.exe',
            path.join(process.env['LOCALAPPDATA'] || '', 'SceneBuilder', 'SceneBuilder.exe')
        );
    } else if (platform === 'darwin') {
        candidates.push(
            '/Applications/SceneBuilder.app/Contents/MacOS/SceneBuilder',
            path.join(process.env['HOME'] || '', 'Applications', 'SceneBuilder.app', 'Contents', 'MacOS', 'SceneBuilder')
        );
    } else {
        candidates.push(
            '/opt/scenebuilder/bin/SceneBuilder',
            '/usr/local/bin/scenebuilder',
            '/usr/bin/scenebuilder',
            '/snap/bin/scenebuilder'
        );
    }

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return undefined;
}

/**
 * Browse for Scene Builder executable using a file dialog and save to settings
 */
export async function setSceneBuilderPath(): Promise<void> {
    const filters: Record<string, string[]> =
        process.platform === 'win32'
            ? { 'Executable': ['exe'] }
            : { 'All Files': ['*'] };

    const result = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: 'Select Scene Builder',
        filters
    });

    if (result && result.length > 0) {
        const selectedPath = result[0].fsPath;
        const config = vscode.workspace.getConfiguration('tlcsdm.javafxSupport');
        await config.update('sceneBuilderPath', selectedPath, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Scene Builder path set to: ${selectedPath}`);
    }
}

/**
 * Open an FXML file in Scene Builder
 */
export function openInSceneBuilder(uri?: vscode.Uri): void {
    const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;

    if (!fileUri) {
        vscode.window.showErrorMessage('No FXML file is currently open.');
        return;
    }

    if (!fileUri.fsPath.endsWith('.fxml')) {
        vscode.window.showErrorMessage('The current file is not an FXML file.');
        return;
    }

    const sceneBuilderPath = getSceneBuilderPath();

    if (!sceneBuilderPath) {
        const browse = 'Browse...';
        const openSettings = 'Open Settings';
        vscode.window
            .showErrorMessage(
                'Scene Builder not found. Please configure the path in settings.',
                browse,
                openSettings
            )
            .then(selection => {
                if (selection === browse) {
                    vscode.commands.executeCommand('tlcsdm.javafxSupport.setSceneBuilderPath');
                } else if (selection === openSettings) {
                    vscode.commands.executeCommand(
                        'workbench.action.openSettings',
                        'tlcsdm.javafxSupport.sceneBuilderPath'
                    );
                }
            });
        return;
    }

    if (!fs.existsSync(sceneBuilderPath)) {
        vscode.window.showErrorMessage(`Scene Builder not found at: ${sceneBuilderPath}`);
        return;
    }

    const child = cp.spawn(sceneBuilderPath, [fileUri.fsPath], {
        detached: true,
        stdio: 'ignore'
    });
    child.unref();
}
