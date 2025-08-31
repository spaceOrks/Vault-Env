import * as vscode from 'vscode';


import {ParamsProvider, ParamItem} from './ParamsProvider';
import {EnvProvider, EnvItem} from './EnvProvider';
import {ConfigsProvider, ConfigItem} from './ConfigsProvider';


export function deactivate() {}

export function activate(context: vscode.ExtensionContext) {
    vscode.commands.executeCommand("setContext", "vaultEnvVisible", false);
    const configProvider = new ParamsProvider(context);
    vscode.window.registerTreeDataProvider('vaultParamsView', configProvider);
    const provider = new ConfigsProvider(context);
    vscode.window.registerTreeDataProvider('vaultSecretsView', provider);
    const currentEvnProvider = new EnvProvider(context);
    vscode.window.registerTreeDataProvider('vaultCurrentEnvView', currentEvnProvider);
    
    context.subscriptions.push(
        
        // -------------------------------- vault-env.servers ---------------------------
        
        vscode.commands.registerCommand('vault-env.servers.listConfigs', async (item: ParamItem) => {
            // const treeView = vscode.window.createTreeView('vaultSecretsView', { treeDataProvider: provider });
            // treeView.title = "Vault Secrets (readonly)";
            configProvider.setSelected(item.name);
            const config = await configProvider.getConfig();
            provider.clearPaths();
            const confList = await provider.listConfigs(config.url, config.token, config.ignoreSsl, config.storage);
            for (const path of confList) {
                await provider.addPath(path.path, path.access);
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
            console.log('config:', config);
            console.log('item.path:', item.path);
            console.log('item.access:', item.access);
            const secret_params = await currentEvnProvider.getEnv(item.path, config);
            if (secret_params === null) {
                return;
            }
            const secret_data = secret_params.secrets;
            // const secret_access = secret_params.secrets;
            if (secret_data !== null) {
                currentEvnProvider.saveNewEnvs(secret_data);    
            }
            currentEvnProvider.refresh();
        }),
        
        vscode.commands.registerCommand('vault-env.configs.add', async () => {

            let config: {url: string, token: string, ignoreSsl: boolean, storage: string};
            try {
                config = await configProvider.getConfig();
            } catch (error) {
                vscode.window.showWarningMessage(`${error}`);
                return;
            }
            let new_secret_path = await vscode.window.showInputBox({
                placeHolder: `input new path to secret (e.g. ${config.storage}/data/my-secret)`,
            });

            if(new_secret_path === undefined) {
                return;
            }
            if (!new_secret_path?.startsWith(`/${config.storage}/data/`)) {
                new_secret_path = new_secret_path.replace(/^\//, '');
                new_secret_path = `${config.storage}/data/${new_secret_path}`;
            }
            try {
                 await provider.createPath(config.url, config.token, config.ignoreSsl, new_secret_path, {});
            } catch (error) {
                vscode.window.showWarningMessage(`${error}`);
                return;
            }
            currentEvnProvider.refresh();
        }),
        vscode.commands.registerCommand('vault-env.configs.remove', async (item: ConfigItem) => {

            let answer = await vscode.window.showQuickPick(["Yes", "No"], {
                placeHolder: `Remove env ${item.label} from Vault? (will not remove local copy)`,
                canPickMany: false
            });
            if(answer === undefined || answer === "No") {
                return;
            }
            let config: {url: string, token: string, ignoreSsl: boolean};
            try {
                config = await configProvider.getConfig();
            } catch (error) {
                vscode.window.showWarningMessage(`${error}`);
                return;
            }
            try {
                 await provider.removePath(config.url, config.token, config.ignoreSsl, item.path);
            } catch (error) {
                vscode.window.showWarningMessage(`${error}`);
                return;
            }
            currentEvnProvider.refresh();
        }),
        // -------------------------------- vault-env.env ---------------------------
        vscode.commands.registerCommand('vault-env.env.closeCurrentEnv', async () => {
            currentEvnProvider.closeCurrentEnv();
            currentEvnProvider.refresh();
        }),
        vscode.commands.registerCommand('vault-env.env.edit', async (item: EnvItem) => {
            let config: {url: string, token: string, ignoreSsl: boolean};
            try {
                config = await configProvider.getConfig();
            } catch (error) {
                vscode.window.showWarningMessage(`${error}`);
                return;
            }
            currentEvnProvider.changeEnv(item.key, config);
        }),
        vscode.commands.registerCommand('vault-env.env.show', async () => {
            currentEvnProvider.showEnv();
        }),
        vscode.commands.registerCommand('vault-env.env.hide', async () => {
            currentEvnProvider.hideEnv();
        }),
        vscode.commands.registerCommand('vault-env.env.add', async () => {
            let new_env_name = await vscode.window.showInputBox({
                placeHolder: `input name of new variable`,
            });
            if(new_env_name === undefined) {
                return;
            }
            // let new_env_value = await vscode.window.showInputBox({
            //     placeHolder: `input value of new variable`,
            // });
            // if(new_env_value === undefined) {
            //     return;
            // }
            let config: {url: string, token: string, ignoreSsl: boolean};
            try {
                config = await configProvider.getConfig();
            } catch (error) {
                vscode.window.showWarningMessage(`${error}`);
                return;
            }
            currentEvnProvider.changeEnv(new_env_name, config);
        }),
        vscode.commands.registerCommand('vault-env.env.remove', async (item: EnvItem) => {
            // let new_env_value = await vscode.window.showInputBox({
            //     placeHolder: `input value of new variable`,
            // });
            // if(new_env_value === undefined) {
            //     return;
            // }
            let config: {url: string, token: string, ignoreSsl: boolean};
            try {
                config = await configProvider.getConfig();
            } catch (error) {
                vscode.window.showWarningMessage(`${error}`);
                return;
            }
            currentEvnProvider.removeEnvParam(item.key, config);
        }),
        vscode.commands.registerCommand('vault-env.env.copyEnv', async (item: EnvItem) => {
            await vscode.env.clipboard.writeText(item.value);
            vscode.window.showInformationMessage(`Copy variable: ${item.key}`);
        })
    );
} 
