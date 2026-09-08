"use strict";
var vscode = require("vscode");

let globalCsrfToken = "";

class PterodactylFileSystemProvider {
    constructor() {
        this._emitter = new vscode.EventEmitter();
        this.onDidChangeFile = this._emitter.event;
        this.cache = new Map();
    }

    getServerUuid(uri) {
        return uri.authority || "";
    }

    getCleanPath(uri) {
        let p = uri.path || "/";
        if (!p.startsWith("/")) p = "/" + p;
        return p;
    }

    getCsrf(uri) {
        if (uri.query) {
            try {
                const params = new URLSearchParams(uri.query);
                const c = params.get("csrf");
                if (c) return c;
            } catch (e) {}
        }
        return globalCsrfToken;
    }

    async request(uri, endpoint, options = {}) {
        const serverUuid = this.getServerUuid(uri);
        const url = "/api/client/servers/" + serverUuid + endpoint;
        const csrfToken = this.getCsrf(uri);
        const headers = {
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            ...(csrfToken ? { "X-XSRF-TOKEN": csrfToken } : {}),
            ...(options.headers || {})
        };

        const res = await fetch(url, {
            ...options,
            credentials: "same-origin",
            headers
        });

        if (!res.ok) {
            let detail = "";
            try {
                const json = await res.json();
                detail = json?.errors?.[0]?.detail || json?.message || "";
            } catch (e) {}

            if (res.status === 404) {
                throw vscode.FileSystemError.FileNotFound(uri);
            }
            if (res.status === 403) {
                throw vscode.FileSystemError.NoPermissions(detail || "Permission denied");
            }
            throw new Error(`Pterodactyl API error (${res.status}): ${detail || res.statusText}`);
        }
        return res;
    }

    async stat(uri) {
        const serverUuid = this.getServerUuid(uri);
        const path = this.getCleanPath(uri);

        if (path === "/" || path === "") {
            return {
                type: vscode.FileType.Directory,
                ctime: 0,
                mtime: 0,
                size: 0,
                permissions: 0
            };
        }

        const cacheKey = serverUuid + ":" + path;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const lastSlash = path.lastIndexOf("/");
        const parentDir = lastSlash <= 0 ? "/" : path.substring(0, lastSlash);
        const fileName = path.substring(lastSlash + 1);

        const listRes = await this.request(uri, "/files/list?directory=" + encodeURIComponent(parentDir));
        const json = await listRes.json();
        const files = json.data || [];
        const item = files.find(f => f.attributes && f.attributes.name === fileName);

        if (!item) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        const statObj = {
            type: item.attributes.is_file ? vscode.FileType.File : vscode.FileType.Directory,
            ctime: new Date(item.attributes.created_at).getTime() || 0,
            mtime: new Date(item.attributes.modified_at).getTime() || 0,
            size: item.attributes.size || 0,
            permissions: 0
        };

        this.cache.set(cacheKey, statObj);
        return statObj;
    }

    async readDirectory(uri) {
        const serverUuid = this.getServerUuid(uri);
        const dir = this.getCleanPath(uri);

        const res = await this.request(uri, "/files/list?directory=" + encodeURIComponent(dir));
        const json = await res.json();
        const files = json.data || [];

        const result = [];
        for (const item of files) {
            const attr = item.attributes;
            if (!attr) continue;
            const type = attr.is_file ? vscode.FileType.File : vscode.FileType.Directory;
            result.push([attr.name, type]);

            const fullChildPath = dir === "/" ? "/" + attr.name : dir + "/" + attr.name;
            this.cache.set(serverUuid + ":" + fullChildPath, {
                type,
                ctime: new Date(attr.created_at).getTime() || 0,
                mtime: new Date(attr.modified_at).getTime() || 0,
                size: attr.size || 0,
                permissions: 0
            });
        }
        return result;
    }

    async readFile(uri) {
        const path = this.getCleanPath(uri);
        const res = await this.request(uri, "/files/contents?file=" + encodeURIComponent(path));
        const buffer = await res.arrayBuffer();
        return new Uint8Array(buffer);
    }

    async writeFile(uri, content, options) {
        const serverUuid = this.getServerUuid(uri);
        const path = this.getCleanPath(uri);

        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        await this.request(uri, "/files/write?file=" + encodeURIComponent(path), {
            method: "POST",
            body: blob,
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            }
        });

        this.cache.delete(serverUuid + ":" + path);
        this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    }

    async createDirectory(uri) {
        const serverUuid = this.getServerUuid(uri);
        const path = this.getCleanPath(uri);

        const lastSlash = path.lastIndexOf("/");
        const root = lastSlash <= 0 ? "/" : path.substring(0, lastSlash);
        const name = path.substring(lastSlash + 1);

        await this.request(uri, "/files/create-folder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ root, name })
        });

        this.cache.delete(serverUuid + ":" + path);
        this._emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
    }

    async delete(uri, options) {
        const serverUuid = this.getServerUuid(uri);
        const path = this.getCleanPath(uri);

        const lastSlash = path.lastIndexOf("/");
        const root = lastSlash <= 0 ? "/" : path.substring(0, lastSlash);
        const name = path.substring(lastSlash + 1);

        await this.request(uri, "/files/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ root, files: [name] })
        });

        this.cache.delete(serverUuid + ":" + path);
        this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
    }

    async rename(oldUri, newUri, options) {
        const serverUuid = this.getServerUuid(oldUri);
        const oldPath = this.getCleanPath(oldUri);
        const newPath = this.getCleanPath(newUri);

        const oldLastSlash = oldPath.lastIndexOf("/");
        const root = oldLastSlash <= 0 ? "/" : oldPath.substring(0, oldLastSlash);
        const fromName = oldPath.substring(oldLastSlash + 1);
        const toName = newPath.substring(newPath.lastIndexOf("/") + 1);

        await this.request(oldUri, "/files/rename", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ root, files: [{ from: fromName, to: toName }] })
        });

        this.cache.delete(serverUuid + ":" + oldPath);
        this.cache.delete(serverUuid + ":" + newPath);
        this._emitter.fire([
            { type: vscode.FileChangeType.Deleted, uri: oldUri },
            { type: vscode.FileChangeType.Created, uri: newUri }
        ]);
    }

    watch(uri, options) {
        return { dispose: () => {} };
    }
}

function activate(context) {
    const folders = vscode.workspace.workspaceFolders || [];
    if (folders.length > 0 && folders[0].uri.query) {
        try {
            const params = new URLSearchParams(folders[0].uri.query);
            const csrf = params.get("csrf");
            if (csrf) globalCsrfToken = csrf;
        } catch (e) {}
    }

    const provider = new PterodactylFileSystemProvider();
    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider("ptero", provider, {
            isCaseSensitive: true,
            isReadonly: false
        })
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
