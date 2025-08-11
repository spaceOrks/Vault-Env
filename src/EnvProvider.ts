import { log } from 'console';
import * as vscode from 'vscode';

import { VaultAPI } from './api/vault_api';



const currentSecretsKey = 'currentSecrets';
const tokenKey = 'vault-env-token';


export class EnvItem extends vscode.TreeItem {
  constructor(
    public readonly key: string,
    public readonly value: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(`${key}: ${value}`, collapsibleState);
    this.command = {
      command: 'vaultEnv.env.copyEnv',
      title: 'vaultEnv.env.copyEnv',
      arguments: [this.value]
    };
    this.contextValue = 'vaultEnvItem';
  }
}
export class EnvProvider implements vscode.TreeDataProvider<EnvItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<EnvItem | undefined | null> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<EnvItem | undefined | null> = this._onDidChangeTreeData.event;
    constructor(private context: vscode.ExtensionContext){
    }
    async getEnv(path: string, config: {url: string, token: string, ignoreSsl: boolean}){
        let secretPath = path;
        
        if (!secretPath){
            secretPath = await vscode.window.showInputBox({
                placeHolder: 'Введите путь Vault (например: secret/data/app/db)'
            }) || "";
        }
        
        if (!config.url || !config.token) {
        vscode.window.showErrorMessage('Vault configuration incomplete. Set vault.url, vault.token in settings.');
        return null;
        }
        if (!secretPath) {
        vscode.window.showErrorMessage('Не указан путь до конфигурации');
        return null;
        }

        try {
            const vault_api = await new VaultAPI(config.url, config.token, config.ignoreSsl);
            const secrets = vault_api.getSecret(secretPath);
            
            if (!secrets) {
                vscode.window.showErrorMessage(`Получена пустая конфигурация`);
                return {};
            }
            return secrets;
            
        } catch (err: any) {
            vscode.window.showErrorMessage(`Vault fetch failed: ${err.message}`);
        }
        return null;
    }
    getTreeItem(element: EnvItem): vscode.TreeItem {
        return element;
    }
    getChildren(element?: EnvItem): Thenable<EnvItem[]> {
        if (!element) {
            const currentSecrets = this.getEnvs();
            const treeItems: EnvItem[] = [];
            for (const [key, value] of Object.entries(currentSecrets)) {
                treeItems.push(new EnvItem(key, value as string, vscode.TreeItemCollapsibleState.None));
            }
        return Promise.resolve(treeItems);
        }
        return Promise.resolve([]);
    }
    
    getEnvs() {
        const currentSecrets = this.context.workspaceState.get<{[key: string]: unknown}>(currentSecretsKey);
        return currentSecrets || {};
    }
    saveNewEnvs(newSecrets: Object | null){
        // @ts-ignore
        const envCollection = this.context.environmentVariableCollection;
        const currentSecrets = this.context.workspaceState.get<{[key: string]: unknown}>(currentSecretsKey);
        if (currentSecrets) {
            for (const [key, value] of Object.entries(currentSecrets)) {
                envCollection.delete(key);
            }
        }
        if (newSecrets) {
            this.context.workspaceState.update(currentSecretsKey, newSecrets);
            for (const [key, value] of Object.entries(newSecrets)) {
                envCollection.replace(key, value as string);
            }
            vscode.window.showInformationMessage('Конфигурация загружена!');
        } else {
            vscode.window.showInformationMessage('нет конфигурации по пути!');
        }
    }
    saveEnv(key: string, value: string) {
        const currentSecrets = this.context.workspaceState.get<{[key: string]: unknown}>(currentSecretsKey);
        if (currentSecrets) {
            currentSecrets[key] = value;
            this.context.workspaceState.update(currentSecretsKey, currentSecrets);
        }
        // @ts-ignore
        const envCollection = this.context.environmentVariableCollection;
        envCollection.replace(key, value as string);
        this.refresh();
    }
    async changeEnv(key: string) {
        let params = this.context.workspaceState.get<{[dict_key: string]: unknown}>(currentSecretsKey);
        let param: string | undefined = undefined;
        if (params) {
            param = params[key] as string;
        }
        
        param = await vscode.window.showInputBox({
            placeHolder: `${param}`
        });
        if (param !== undefined) {
            this.saveEnv(key, param);
        }
    }
    refresh(){
        this._onDidChangeTreeData.fire(undefined);
    }
}
