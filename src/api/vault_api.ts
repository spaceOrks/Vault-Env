import { log } from 'console';
import * as vscode from 'vscode';
import fetch, { RequestInit } from 'node-fetch';
import * as https from 'https';
import * as crypto from 'crypto';


export class VaultAPI{
    constructor(
        public readonly url: string,
        public readonly token: string,
        public readonly ignoreSsl: boolean
    ) {
    }
  
    async getRequest(method: 'GET' | 'LIST', endpoint: string): Promise<{[key: string]: unknown} | null> {
        const fullUrl = `${this.url}${endpoint}`;
        const agent = new https.Agent({
            rejectUnauthorized: !this.ignoreSsl,
            secureOptions: crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
            secureProtocol: 'TLSv1_2_method'
        });

        const options: RequestInit = {
            method: method,
            headers: {
                'X-Vault-Token': this.token
            },
            agent: agent as any
        };
                
        let data = {};
        try {
            const response = await fetch(fullUrl, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - ${response.statusText} - ${response.body.read()}`);
            }
            data = await response.json();
            return data;
        } catch (err) {
            vscode.window.showErrorMessage(`error: ${err}`);
            console.log(`error: ${err}`);
        }
        return null;
    }   
    async getSecret(secretPath: string): Promise<Object | null> {
        const path = `/v1/${secretPath}`;
        const data = await this.getRequest("GET", path);
        if (!data) {
            return {};
        }
        // @ts-ignore
        const secrets = data.data?.data || data.data;
        return secrets;        
    }
    async getList(secretPath: string, subfolder: string = ""): Promise<string[]> {
        if (secretPath.endsWith('/')) {
            secretPath = secretPath.slice(0, -1);
        }
        const path = `/v1/${secretPath}/metadata/${subfolder}?list=true`;
        
        const data = await this.getRequest("LIST", path);
        if (!data) {
            return [];
        }
        let folders: string[] = [];
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
}



export async function listAllSecretsRecursive(
  baseUrl: string,
  token: string,
  path: string = 'secret/metadata/'
): Promise<string[]> {
  const secrets: string[] = [];

  async function walk(currentPath: string) {
    const url = `${baseUrl}/v1/${currentPath}?list=true`;
    const res = await fetch(url, {
      method: 'LIST',
      headers: {
        'X-Vault-Token': token,
      },
    });

    if (!res.ok) return;

    const data = await res.json();
    if (!data.data || !data.data.keys) return;

    for (const key of data.data.keys) {
      if (key.endsWith('/')) {
        await walk(currentPath + key);
      } else {
        secrets.push(currentPath.replace('metadata/', 'data/') + key);
      }
    }
  }
    if (!res.ok) {
      console.error(`Failed to fetch secrets: HTTP ${res.status} - ${res.statusText}`);
      return;
    }
  await walk(path);
  return secrets;
}