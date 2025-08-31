import * as vscode from 'vscode';

import { VaultAPI } from './api/vault_api';



const currentSecretsKey = 'currentSecrets';
const tokenKey = 'vault-env-token';


export class EnvItem extends vscode.TreeItem {
  constructor(
    public readonly key: string,
    public readonly value: string,
    public readonly showEnv: boolean,    
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    const text = showEnv ? value : '********';
    super(`${key}: ${text}`, collapsibleState);
    this.command = {
      command: 'vault-env.env.copyEnv',
      title: 'vault-env.env.copyEnv',
      arguments: [this]
    };
    this.contextValue = 'vaultEnvItem';
  }
}
export class EnvProvider implements vscode.TreeDataProvider<EnvItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<EnvItem | undefined | null> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<EnvItem | undefined | null> = this._onDidChangeTreeData.event;
    private _showEnv = false;
    private _currentPath = '';
    constructor(private context: vscode.ExtensionContext){

    }
    async getEnv(path: string, config: {url: string, token: string, ignoreSsl: boolean}): Promise<{secrets: {[key: string]: any}, access: string[]} | null>{
        this._currentPath = path;
        
        if (!this._currentPath){
            this._currentPath = await vscode.window.showInputBox({
                placeHolder: 'Enter the Vault path (eg: secret/data/app/db)'
            }) || "";
        }
        
        if (!config.url || !config.token) {
        vscode.window.showErrorMessage('Vault configuration incomplete. Set vault.url, vault.token in settings.');
        return null;
        }
        if (!this._currentPath) {
        vscode.window.showErrorMessage('Path to configuration not specified');
        return null;
        }

        try {
            const vault_api = await new VaultAPI(config.url, config.token, config.ignoreSsl);
            const secrets = await vault_api.getSecret(this._currentPath);
            const access = await vault_api.checkAccess([this._currentPath]);
            
            if (!secrets) {
                vscode.window.showErrorMessage(`Empty configuration received`);
                return {secrets: {}, access: access[path] || []};
            }
            return {secrets: secrets, access: access[path] || []};
            
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
                treeItems.push(new EnvItem(key, value as string, this._showEnv, vscode.TreeItemCollapsibleState.None));
            }
        return Promise.resolve(treeItems);
        }
        return Promise.resolve([]);
    }
    showEnv() {
        this._showEnv = true;
        vscode.commands.executeCommand("setContext", "vaultEnvVisible", true);
        this.refresh();
    }
    hideEnv() {
        this._showEnv = false;
        vscode.commands.executeCommand("setContext", "vaultEnvVisible", false);
        this.refresh();
    }
    getEnvs() {
        const envCollection = this.context.environmentVariableCollection;
        const configs: {[key: string]: unknown} = {};
        envCollection.forEach((key, mutator) => {
            if (mutator.value !== undefined) {
                configs[key] = mutator.value;
            }
        });
        return configs;
    }
    closeCurrentEnv(){
        // @ts-ignore
        const envCollection = this.context.environmentVariableCollection;
        envCollection.clear();
    }
    saveNewEnvs(newSecrets: Object | null){
        // @ts-ignore
        this.closeCurrentEnv();

        const envCollection = this.context.environmentVariableCollection;
        if (newSecrets) {
            for (const [key, value] of Object.entries(newSecrets)) {
                envCollection.replace(key, value as string);
            }
            vscode.window.showInformationMessage('Configuration loaded!');
        } else {
            vscode.window.showInformationMessage('No configuration on the way!');
        }
    }
    async saveEnv(key: string, value: string, config: {url: string, token: string, ignoreSsl: boolean}) {
        // @ts-ignore
        const envCollection = this.context.environmentVariableCollection;
        envCollection.replace(key, value as string);
        this.refresh();
        if(!this._currentPath) {
            vscode.window.showErrorMessage('Path to configuration not specified');
            return;
        }
        const data: {[key: string]: any} = {};
        envCollection.forEach((k, v) => {
            data[k] = v.value;
        });
        await new VaultAPI(config.url, config.token, config.ignoreSsl).updateSecret(this._currentPath, data);
    }
    async changeEnv(key: string, config: {url: string, token: string, ignoreSsl: boolean}): Promise<string | undefined> {
        const envCollection = this.context.environmentVariableCollection;
        let variable: vscode.EnvironmentVariableMutator | undefined = envCollection.get(key);
        let param: string | undefined = undefined;
        if (variable !== undefined) {
            param = variable.value;
        }
        param = await vscode.window.showInputBox({
            placeHolder: `${param}`
        });
        if (param !== undefined) {
            this.saveEnv(key, param, config);
        }
        return param;
    }
    async removeEnvParam(key: string, config: {url: string, token: string, ignoreSsl: boolean}): Promise<void> {
        const envCollection = this.context.environmentVariableCollection;
        let variable: vscode.EnvironmentVariableMutator | undefined = envCollection.get(key);
        if(variable === undefined) {
            return;
        }
        envCollection.delete(key);
        this.refresh();
        const data: {[key: string]: any} = {};
        envCollection.forEach((k, v) => {
            data[k] = v.value;
        });
        await new VaultAPI(config.url, config.token, config.ignoreSsl).updateSecret(this._currentPath, data);
        return ;
    }
    refresh(){
        this._onDidChangeTreeData.fire(undefined);
    }
}
