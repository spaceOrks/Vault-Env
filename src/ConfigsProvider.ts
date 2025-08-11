import { log } from 'console';
import * as vscode from 'vscode';
import fetch, { RequestInit } from 'node-fetch';
import * as https from 'https';
import * as crypto from 'crypto';

import { listAllSecretsRecursive, VaultAPI } from './api/vault_api';

const currentSecretsKey = 'currentSecrets';
const tokenKey = 'vault-env-token';


export class ConfigItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly path: string
  ) {
    super(label, collapsibleState);
    this.command = {
      command: 'vaultEnv.configs.loadSecret',
      title: 'Load Secret',
      arguments: [this]
    };
    this.contextValue = 'VaultItem';
  }
}

export class ConfigsProvider implements vscode.TreeDataProvider<ConfigItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConfigItem | undefined | null> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<ConfigItem | undefined | null> = this._onDidChangeTreeData.event;
    public items: string[];
    constructor(private context: vscode.ExtensionContext){
        this.items = context.globalState.get<string[]>('vaultPaths') || [];
        
    }
    getTreeItem(element: ConfigItem): vscode.TreeItem {
        return element;
    }
    getChildren(element?: ConfigItem): Thenable<ConfigItem[]> {
        if (!element) {
        // корневые элементы (пути Vault)
        const treeItems = this.items.map(item => new ConfigItem(item, vscode.TreeItemCollapsibleState.None, item));

        return Promise.resolve(treeItems);
        }
        return Promise.resolve([]);
    }
    async addPath(path: string) {
        const newItem = new ConfigItem(path, vscode.TreeItemCollapsibleState.None, path);
        this.items.push(path);
        this._onDidChangeTreeData.fire(undefined);
        await this.context.globalState.update('vaultPaths', this.items);
    }
    async removePath(path: string) {
        this.items = this.items.filter(p => p !== path);
        this._onDidChangeTreeData.fire(undefined);
        await this.context.globalState.update('vaultPaths', this.items);
    }
    async clearPaths() {
        this.items = [];
        this._onDidChangeTreeData.fire(undefined);
        await this.context.globalState.update('vaultPaths', this.items);
    }
    async listConfigs(url: string, token: string, ignoreSsl: boolean) {
        const vault_api = await new VaultAPI(url, token, ignoreSsl);
        const list = await vault_api.getList("configs");
        return list;
        console.log("list:", list);
    }
}

