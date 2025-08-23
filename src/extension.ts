import * as vscode from 'vscode';


import {ParamsProvider, ParamItem} from './ParamsProvider';
import {EnvProvider, EnvItem} from './EnvProvider';
import {ConfigsProvider, ConfigItem} from './ConfigsProvider';


export function deactivate() {}

export function activate(context: vscode.ExtensionContext) {
    const configProvider = new ParamsProvider(context);
    vscode.window.registerTreeDataProvider('vaultParamsView', configProvider);
    const provider = new ConfigsProvider(context);
    vscode.window.registerTreeDataProvider('vaultSecretsView', provider);
    const currentEvnProvider = new EnvProvider(context);
    vscode.window.registerTreeDataProvider('vaultCurrentEnvView', currentEvnProvider);
    
    context.subscriptions.push(
        
        // -------------------------------- vault-env.servers ---------------------------
        
        vscode.commands.registerCommand('vault-env.servers.listConfigs', async (item: ParamItem) => {
            
            configProvider.setSelected(item.name);
            const config = await configProvider.getConfig();
            console.log("config: ", config);
            provider.clearPaths();
            const confList = await provider.listConfigs(config.url, config.token, config.ignoreSsl, config.storage);
            for (const path of confList) {
                await provider.addPath(path);
            }
            // vscode.window.showInformationMessage(`Loading secret at: ${item.label}`);
            // const config = await configProvider.getConfig();
            
            // const newSecrets = await currentEvnProvider.getEnv(item.path);
            // if (newSecrets !== null) {
            //     currentEvnProvider.saveNewEnvs(newSecrets);    
            // }
            // currentEvnProvider.refresh();
        }),
        vscode.commands.registerCommand('vault-env.servers.addServer', async () => {
            const name = await vscode.window.showInputBox({
                placeHolder: 'Введите уникальное название для сохранения конфиги'
            });
            // const url = await vscode.window.showInputBox({
            //     placeHolder: 'Введите адрес сервера'
            // });
            // const token = await vscode.window.showInputBox({
            //     placeHolder: 'Введите токен',
            //     password: true
            // });
            const url = "";
            const token = "";
            if (name) {
                if(!await configProvider.addServer(name, url, token)){
                    vscode.window.showErrorMessage(`Server already exists: ${name}`);
                }
            } else {
                    vscode.window.showErrorMessage(`Empty server's name`);
                
            }
        }),
        vscode.commands.registerCommand('vault-env.servers.removeServer', async (item: ParamItem) => {
            if (!item) {return;}

            const confirm = await vscode.window.showWarningMessage(
                `Удалить путь: ${item.label}?`,
                { modal: true },
                'Удалить'
            );
            if (confirm === 'Удалить') {
                await configProvider.removeServer(item.name);
            }
        }),
        vscode.commands.registerCommand('vault-env.servers.changeUrl', async (server_name: string) => {
            await configProvider.saveNewUrl(server_name);
        }),
        vscode.commands.registerCommand('vault-env.servers.changeName', async (server_name: string) => {
            await configProvider.saveNewName(server_name);
        }),
        vscode.commands.registerCommand('vault-env.servers.changeStorage', async (server_name: string) => {
            await configProvider.saveNewStorage(server_name);
        }),
        vscode.commands.registerCommand('vault-env.servers.changeToken', async (server_name: string) => {
            await configProvider.saveNewPassword(server_name);
        }),
        vscode.commands.registerCommand('vault-env.servers.changeIgnoreSsl', async (server_name: string) => {
            await configProvider.saveNewSsl(server_name);
        }),
        
        // -------------------------------- vault-env.configs ---------------------------
        
        vscode.commands.registerCommand('vault-env.configs.loadSecret', async (item: ConfigItem) => {
            vscode.window.showInformationMessage(`Loading secret at: ${item.label}`);
            let config: {url: string, token: string, ignoreSsl: boolean};
            try {
                config = await configProvider.getConfig();
                
            } catch (error) {
                vscode.window.showWarningMessage(`${error}`);
                return;
            }
            const newSecrets = await currentEvnProvider.getEnv(item.path, config);
            if (newSecrets !== null) {
                currentEvnProvider.saveNewEnvs(newSecrets);    
            }
            currentEvnProvider.refresh();
        }),
        
        // -------------------------------- vault-env.env ---------------------------
        vscode.commands.registerCommand('vault-env.env.closeCurrentEnv', async () => {
            currentEvnProvider.closeCurrentEnv();
            currentEvnProvider.refresh();
        }),
        vscode.commands.registerCommand('vault-env.env.edit', async (item: EnvItem) => {
            console.log("item:", item);
            console.log("item.key:", item.key);
            currentEvnProvider.changeEnv(item.key);
        }),
        vscode.commands.registerCommand('vault-env.env.copyEnv', async (text: string) => {
            await vscode.env.clipboard.writeText(text);
        })
    );
} 
