import { log } from 'console';
import * as vscode from 'vscode';
import * as https from 'https';
import * as crypto from 'crypto';


export class VaultAPI{
    constructor(
        public readonly url: string,
        public readonly token: string,
        public readonly ignoreSsl: boolean
    ) {
    }
    
    private async _postRequest(endpoint: string, data: {[key: string]: any}): Promise<{[key: string]: any} | null> {
        const method = 'POST';
        const fullUrl = `${this.url}${endpoint}`;
        const agent = new https.Agent({
            rejectUnauthorized: !this.ignoreSsl,
            secureOptions: crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
            secureProtocol: 'TLSv1_2_method'
        });

        const options = {
            method: method,
            headers: {
                'X-Vault-Token': this.token
            },
            agent: agent,
            body: JSON.stringify(data)
        };
                
        let response_data = {};
        try {
            const { default: fetch } = await import('node-fetch');
            const response = await fetch(fullUrl, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - ${response.statusText} - ${response.body?.read()}`);
            }
            response_data = await response.json() as {};
            return response_data;
        } catch (err) {
            vscode.window.showErrorMessage(`error: ${err}`);
            console.log(`error: ${err}`);
        }
        return null;
    }   
    private async _getRequest(method: 'GET' | 'LIST', endpoint: string): Promise<{[key: string]: unknown} | null> {
        const fullUrl = `${this.url}${endpoint}`;
        const agent = new https.Agent({
            rejectUnauthorized: !this.ignoreSsl,
            secureOptions: crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
            secureProtocol: 'TLSv1_2_method'
        });

        const options = {
            method: method,
            headers: {
                'X-Vault-Token': this.token
            },
            agent: agent
        };
                
        let data = {};
        try {
            const { default: fetch } = await import('node-fetch');
            const response = await fetch(fullUrl, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - ${response.statusText} - ${response.body?.read()}`);
            }
            data = await response.json() as {};
            return data;
        } catch (err) {
            vscode.window.showErrorMessage(`error: ${err}`);
            console.log(`error: ${err}`);
        }
        return null;
    }   
    private async _deleteRequest(method: 'DELETE', endpoint: string): Promise<void> {
        const fullUrl = `${this.url}${endpoint}`;
        const agent = new https.Agent({
            rejectUnauthorized: !this.ignoreSsl,
            secureOptions: crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
            secureProtocol: 'TLSv1_2_method'
        });

        const options = {
            method: method,
            headers: {
                'X-Vault-Token': this.token
            },
            agent: agent
        };
                
        try {
            const { default: fetch } = await import('node-fetch');
            const response = await fetch(fullUrl, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - ${response.statusText} - ${response.body?.read()}`);
            }
        } catch (err) {
            vscode.window.showErrorMessage(`error: ${err}`);
            console.log(`error: ${err}`);
        }
    }   
    async getSecret(secretPath: string): Promise<Object | null> {
        const path = `/v1/${secretPath}`;
        const data = await this._getRequest("GET", path);
        if (!data) {
            return {};
        }
        // @ts-ignore
        const secrets = data.data?.data || data.data;
        return secrets;        
    }
    async removeSecret(secretPath: string): Promise<void> {
        secretPath = secretPath.replace(/\/data\//, "/metadata/"); // remove leading slash if present
        const path = `/v1/${secretPath}`;
        await this._deleteRequest("DELETE", path);
    }
    async getList(secretPath: string, subfolder: string = ""): Promise<string[]> {
        if (secretPath.endsWith('/')) {
            secretPath = secretPath.slice(0, -1);
        }
        const path = `/v1/${secretPath}/metadata/${subfolder}?list=true`;
        
        const data = await this._getRequest("LIST", path);
        if (!data) {
            return [];
        }
        let folders: string[] = [];
        console.log("data:", data);
        // @ts-ignore
        for (const element of data.data.keys) {
            if (element.endsWith('/')) {
                // if (!secretPath.endsWith('/')) {
                //     secretPath += '/';
                // }
                const tmp = await this.getList(secretPath, subfolder + element);
                if (tmp) {
                    folders = [...new Set([...folders, ...tmp])];
                }
            } else {
                folders.push(`${secretPath}/data/${subfolder}${element}`);
            }
        }
        return folders;        
    }
    async updateSecret(secretPath: string, data: {[key: string]: any}): Promise<any> {
        if (secretPath.endsWith('/')) {
            secretPath = secretPath.slice(0, -1);
        }
        const path = `/v1/${secretPath}`;
        
        const response_data = await this._postRequest(path, {data: data});
        return response_data;  
    }
    async checkAccess(secretPath: string[]): Promise<{[key: string]: string[]}> {
        const path = `/v1/sys/capabilities-self`;
        const data = {
            "paths": secretPath
        };
        
        const response_data = await this._postRequest(path, data) as {'data': {[key: string]: string[]}} | null; 
        if (!response_data) {
            return {};
        }
        console.log('response_data:', response_data);
        return response_data['data'] as {[key: string]: string[]};  
    }
}
