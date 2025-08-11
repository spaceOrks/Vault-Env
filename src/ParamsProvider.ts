import { log } from 'console';
import * as vscode from 'vscode';
import fetch, { RequestInit } from 'node-fetch';
import * as https from 'https';
import * as crypto from 'crypto';

const currentSecretsKey = 'currentSecrets';
const VAULT_SERVERS_KEY = 'vaultServers';
const tokenKey = 'vaultServersSecrets';



export class ParamItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly url?: string
  ) {
    super(name + ` (${url})`, vscode.TreeItemCollapsibleState.None);
    this.command = {
      command: 'vaultEnv.servers.listConfigs',
      title: 'List allowed configs',
      arguments: [this]
    };
    this.contextValue = 'ParamItem';
    
    // this.iconPath = {'id': 'globe'};
  }
}
export class ParamsProvider implements vscode.TreeDataProvider<ParamItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ParamItem | undefined | null> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<ParamItem | undefined | null> = this._onDidChangeTreeData.event;
    public items: {"name": string, "url"?: string, "ignoreSsl"?: boolean}[];
    public selectedConfig: string;

    // private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter();
    // readonly onDidChangeTreeData: vscode.Event<VaultItem | undefined | null> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {
        this.context = context;
        this.items = this._getServers();
        this.selectedConfig = "";
    }
    getTreeItem(element: ParamItem): ParamItem {
        return element;
    }
    getChildren(): vscode.ProviderResult<ParamItem[]> {
        const elems: ParamItem[] = [];
        this.items.forEach(elem => {
            elems.push(new ParamItem(elem.name, elem.url));
        });
        return elems;
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    async addServer(name: string, url: string, password: string): Promise<boolean> {
        try {
            const newItem = {name, url};
            let is_exists = false;
            this.items.forEach(element => {
                if(element.name === name) {
                    is_exists = true;
                }
            });
            if (is_exists){
                return false;
            }
            this.items.push(newItem);
            this._updateServerPassword(name, password);
            await this._updateServers();
            this.refresh();
            return true;
        } catch (error) {
            console.error(`error ${error}`);
        }
        return false;
    }
    async removeServer(name: string) {
        this.items = this.items.filter(p => p.name !== name);
        await this._updateServers();
        if (this.selectedConfig === name) {
            this.selectedConfig = "";
        }
        this.refresh();
    }
    getSelected(){
        return this.selectedConfig;
    }
    setSelected(name: string){
        return this.selectedConfig = name;
    }
    async saveNewUrl(server_name: string) {
        console.log('server_name:', server_name);
        const server = this._getServer(server_name);
        let url = await vscode.window.showInputBox({
            placeHolder: `Введите адрес Vault (например: ${server?.url || 'https://vault.local:8765'})`
        });
        console.log(`new url[${server_name}]: ${url}`);
        if (url === undefined){
            return;
        }
        this._updateServer(server_name, undefined, url);
        return url;
    } 
    async saveNewName(server_name: string) {
        console.log('server_name:', server_name);
        const server = this._getServer(server_name);
        let new_name = await vscode.window.showInputBox({
            placeHolder: `Введите новое название (например: ${server?.name || 'Test server'})`
        });
        console.log(`new url[${server_name}]: ${new_name}`);
        if (new_name === undefined){
            return;
        }
        this._updateServer(server_name, new_name);
        return new_name;
    } 
    async saveNewPassword(server_name: string) {
        // @ts-ignore
        let token = await vscode.window.showInputBox({
            placeHolder: `Введите новый токен для ${server_name}`
        });
        if(token !== undefined){
            this._updateServerPassword(server_name, token);
        }
        return token;
    }
    private async _updateServerPassword(server_name: string, token: string) {
        // @ts-ignore
        let all_tokens_str: string = await this.context.secrets.get(tokenKey);
        let all_tokens: { [key: string]: string };
        if(!all_tokens_str) {
            all_tokens = {};
        } else {
            all_tokens = JSON.parse(all_tokens_str);
        }
        if(!all_tokens) {
            all_tokens = {};
        }
        all_tokens[server_name] = token;
        // @ts-ignore
        await this.context.secrets.store(tokenKey, JSON.stringify(all_tokens));
        this.refresh();
        return token;
    }
    private async _getServerPassword(server_name: string) {
        // @ts-ignore
        let all_tokens = await this.context.secrets.get(tokenKey);
        let tokensObj: { [key: string]: string } = {};
        if (all_tokens) {
            tokensObj = JSON.parse(all_tokens) as { [key: string]: string };
        } else {
            return undefined;
        }         
        const token: string | undefined = tokensObj[server_name];
        return token;
    }
    async getConfig() {
        const name = this.getSelected();
        const config = this._getServer(name);
        if (config === undefined) {
            throw Error(`Не существует выбранного сервера: '${name}'`);
        }
        const url = config.url;
        const token = this._getServerPassword(name);
        if (token === undefined) {
            throw Error(`Не существует токена для выбранного сервера: '${name}'`);
        }
        return {
            url: url as string,
            // @ts-ignore
            token: await token as string,
            ignoreSsl: config.ignoreSsl ?? true,
        };
    }
    private _getServers() {
        return this.context.globalState.get<{"name": string, "url"?: string, "ignoreSsl"?: boolean}[]>(VAULT_SERVERS_KEY) || [];
    }
    private _getServer(server_name: string) {
        const servers = this.items;
        for (let index = 0; index < servers.length; index++) {
            if (servers[index].name === server_name) {
                return servers[index];
            }
        }
        return undefined;
    }
    private _updateServer(server_name: string, new_name?: string, new_url?: string, ignoreSsl?: boolean) {
        const servers = this.items;
        let index = 0;
        console.log(`_updateServer: server_name: ${server_name}, new_name: ${new_name}, new_url: ${new_url}, length: ${servers.length}`);
        for (; index < servers.length; index++) {
            console.log(`server: name: ${servers[index].name}, url: ${servers[index].url}`);
            if (servers[index].name === server_name) {
                if (new_name !== undefined) {
                    servers[index].name = new_name;
                }
                if (new_url !== undefined) {
                    servers[index].url = new_url;
                }
                break;
            }
        }
        if (index === servers.length && new_name !== undefined) {
            servers.push({
                "name": new_name,
                "url": new_url
            });
        }
        this._updateServers();
    }
    private async _updateServers() {
        await this.context.globalState.update(VAULT_SERVERS_KEY, this.items);
        this.refresh();
    }
}
