import * as vscode from 'vscode';

import { VaultAPI } from './api/vault_api';

const currentSecretsKey = 'currentSecrets';
const tokenKey = 'vault-env-token';


export class ConfigItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly path: string,
    public readonly access: string[] = []
  ) {
    super(label, collapsibleState);
    this.command = {
      command: 'vault-env.configs.loadSecret',
      title: 'Load Secret',
      arguments: [this]
    };
    this.contextValue = 'access' + (access.includes('read') ? ' read' : '') + (access.includes('list') ? ' list' : '') + (access.includes('create') ? ' create' : '') + (access.includes('update') ? ' update' : '') + (access.includes('delete') ? ' delete' : '') + (access.includes('sudo') ? ' sudo' : '');
    console.log('this.contextValue:', this.contextValue);
  }
}

export class ConfigsProvider implements vscode.TreeDataProvider<ConfigItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConfigItem | undefined | null> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<ConfigItem | undefined | null> = this._onDidChangeTreeData.event;
    public items: {path: string, access: string[]}[];
    constructor(private context: vscode.ExtensionContext){
        // this.items = context.globalState.get<string[]>('vaultPaths') || [];
        this.items = [];
        
    }
    getTreeItem(element: ConfigItem): vscode.TreeItem {
        return element;
    }
    getChildren(element?: ConfigItem): Thenable<ConfigItem[]> {
        if (!element) {
        // корневые элементы (пути Vault)
        const treeItems = this.items.map(item => new ConfigItem(item.path, vscode.TreeItemCollapsibleState.None, item.path, item.access || []));

        return Promise.resolve(treeItems);
        }
        return Promise.resolve([]);
    }
    async addPath(path: string, access: string[]) {
        const newItem = new ConfigItem(path, vscode.TreeItemCollapsibleState.None, path, access);
        this.items.push({path, access});
        this._onDidChangeTreeData.fire(undefined);
        // await this.context.globalState.update('vaultPaths', this.items);
    }
    async createPath(url: string, token: string, ignoreSsl: boolean, path: string, data: {[key: string]: any} = {}) {
        await new VaultAPI(url, token, ignoreSsl).updateSecret(path, data);
        this.addPath(path, ['read', 'create', 'update', 'delete']);
    }
    async removePath(url: string, token: string, ignoreSsl: boolean, path: string) {
        await new VaultAPI(url, token, ignoreSsl).removeSecret(path);
        this.items = this.items.filter(p => p.path !== path);
        this._onDidChangeTreeData.fire(undefined);
        // await this.context.globalState.update('vaultPaths', this.items);
    }
    async clearPaths() {
        this.items = [];
        this._onDidChangeTreeData.fire(undefined);
        // await this.context.globalState.update('vaultPaths', this.items);
    }
    async listConfigs(url: string, token: string, ignoreSsl: boolean, storage: string): Promise<{path: string, access: string[]}[]> {
        const vault_api = await new VaultAPI(url, token, ignoreSsl);
        const list = await vault_api.getList(storage);
        const access = await vault_api.checkAccess(list);
        const res = [];
        for (let index = 0; index < list.length; index++) {
          const path = list[index];
          if (!access[path] || !access[path].includes('read')) {
            vscode.window.showWarningMessage(`No read access to path: ${path}`);
            list.splice(index, 1);
            index--;
            continue;
          } 
          const access_rights = access[path];
          res.push({
            path: path,
            access: access_rights
          });
        }
        return res;
    }
}

