"use strict";
var vscode = require("vscode");

let globalCsrfToken = "";
let globalOrigin = "";
let globalServerUuid = "";

class PterodactylFileSystemProvider {
    constructor() {
        this._emitter = new vscode.EventEmitter();
        this.onDidChangeFile = this._emitter.event;
        this.cache = new Map();
    }

    getOrigin(uri) {
        if (uri && uri.query) {
            try {
                const params = new URLSearchParams(uri.query);
                const o = params.get("origin");
                if (o) return o;
            } catch (e) {}
        }
        if (globalOrigin) return globalOrigin;
        if (vscode.workspace && vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                if (folder.uri && folder.uri.query) {
                    try {
                        const params = new URLSearchParams(folder.uri.query);
                        const o = params.get("origin");
                        if (o) {
                            globalOrigin = o;
                            return o;
                        }
                    } catch (e) {}
                }
            }
        }
        if (typeof location !== "undefined" && location.origin && location.origin !== "null") {
            return location.origin;
        }
        if (typeof globalThis !== "undefined" && globalThis._VSCODE_FILE_ROOT) {
            try {
                return new URL(globalThis._VSCODE_FILE_ROOT).origin;
            } catch (e) {}
        }
        return "";
    }

    getServerUuid(uri) {
        if (uri && uri.authority) return uri.authority;
        if (uri && uri.query) {
            try {
                const params = new URLSearchParams(uri.query);
                const s = params.get("server");
                if (s) return s;
            } catch (e) {}
        }
        if (globalServerUuid) return globalServerUuid;
        if (vscode.workspace && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const first = vscode.workspace.workspaceFolders[0];
            if (first.uri) {
                if (first.uri.authority) return first.uri.authority;
                if (first.uri.query) {
                    try {
                        const params = new URLSearchParams(first.uri.query);
                        const s = params.get("server");
                        if (s) {
                            globalServerUuid = s;
                            return s;
                        }
                    } catch (e) {}
                }
            }
        }
        return "";
    }

    getCleanPath(uri) {
        let p = (uri && uri.path) ? uri.path : "/";
        p = p.replace(/\\/g, "/");
        if (!p.startsWith("/")) p = "/" + p;
        if (p.length > 1 && p.endsWith("/")) {
            p = p.substring(0, p.length - 1);
        }
        return p;
    }

    getCsrf(uri) {
        if (uri && uri.query) {
            try {
                const params = new URLSearchParams(uri.query);
                const c = params.get("csrf");
                if (c) return c;
            } catch (e) {}
        }
        if (!globalCsrfToken && vscode.workspace && vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                if (folder.uri && folder.uri.query) {
                    try {
                        const params = new URLSearchParams(folder.uri.query);
                        const c = params.get("csrf");
                        if (c) {
                            globalCsrfToken = c;
                            return c;
                        }
                    } catch (e) {}
                }
            }
        }
        return globalCsrfToken;
    }

    async request(uri, endpoint, options = {}) {
        const serverUuid = this.getServerUuid(uri);
        const origin = this.getOrigin(uri);
        const url = origin + "/api/client/servers/" + serverUuid + endpoint;
        const csrfToken = this.getCsrf(uri);
        const headers = {
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            ...(csrfToken ? { "X-XSRF-TOKEN": csrfToken } : {}),
            ...(options.headers || {})
        };

        console.log(`[PteroFS] Fetching: ${url}`);

        try {
            const res = await fetch(url, {
                ...options,
                credentials: "include",
                headers
            });

            if (!res.ok) {
                let detail = "";
                try {
                    const json = await res.json();
                    detail = json?.errors?.[0]?.detail || json?.message || "";
                } catch (e) {}

                console.error(`[PteroFS] API error ${res.status} on ${url}:`, detail);

                if (res.status === 404) {
                    throw vscode.FileSystemError.FileNotFound(uri);
                }
                if (res.status === 403) {
                    throw vscode.FileSystemError.NoPermissions(detail || "Permission denied");
                }
                throw new Error(`Pterodactyl API error (${res.status}): ${detail || res.statusText}`);
            }
            return res;
        } catch (err) {
            console.error(`[PteroFS] Network error for ${url}:`, err);
            throw err;
        }
    }

    async stat(uri) {
        const serverUuid = this.getServerUuid(uri);
        const path = this.getCleanPath(uri);

        if (path === "/" || path === "") {
            return {
                type: vscode.FileType.Directory,
                ctime: 0,
                mtime: 0,
                size: 0
            };
        }

        const cacheKey = serverUuid + ":" + path;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        console.log(`[PteroFS] stat cache miss for "${path}", fetching parent directory listing...`);

        const lastSlash = path.lastIndexOf("/");
        const parentDir = lastSlash <= 0 ? "/" : path.substring(0, lastSlash);

        const listRes = await this.request(uri, "/files/list?directory=" + encodeURIComponent(parentDir));
        const json = await listRes.json();
        const files = json.data || [];

        for (const f of files) {
            if (f.attributes && f.attributes.name) {
                const childPath = parentDir === "/" ? "/" + f.attributes.name : parentDir + "/" + f.attributes.name;
                this.cache.set(serverUuid + ":" + childPath, {
                    type: f.attributes.is_file ? vscode.FileType.File : vscode.FileType.Directory,
                    ctime: f.attributes.created_at ? new Date(f.attributes.created_at).getTime() : 0,
                    mtime: f.attributes.modified_at ? new Date(f.attributes.modified_at).getTime() : 0,
                    size: typeof f.attributes.size === "number" ? f.attributes.size : (Number(f.attributes.size) || 0)
                });
            }
        }

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        console.warn(`[PteroFS] File not found for stat: "${path}"`);
        throw vscode.FileSystemError.FileNotFound(uri);
    }

    async readDirectory(uri) {
        const serverUuid = this.getServerUuid(uri);
        const dir = this.getCleanPath(uri);

        console.log(`[PteroFS] readDirectory requested: dir="${dir}", server="${serverUuid}"`);

        const queryDir = (dir === "/" || dir === "") ? "/" : dir;
        const res = await this.request(uri, "/files/list?directory=" + encodeURIComponent(queryDir));
        const json = await res.json();
        const files = json.data || [];

        console.log(`[PteroFS] readDirectory returned ${files.length} items in "${dir}"`);

        const result = [];
        for (const item of files) {
            const attr = item.attributes;
            if (!attr || !attr.name) continue;
            const type = attr.is_file ? vscode.FileType.File : vscode.FileType.Directory;
            result.push([attr.name, type]);

            const fullChildPath = dir === "/" ? "/" + attr.name : dir + "/" + attr.name;
            this.cache.set(serverUuid + ":" + fullChildPath, {
                type,
                ctime: attr.created_at ? new Date(attr.created_at).getTime() : 0,
                mtime: attr.modified_at ? new Date(attr.modified_at).getTime() : 0,
                size: typeof attr.size === "number" ? attr.size : (Number(attr.size) || 0)
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
    const updateWorkspaceInfo = () => {
        const folders = vscode.workspace.workspaceFolders || [];
        for (const folder of folders) {
            if (folder.uri) {
                if (folder.uri.authority) globalServerUuid = folder.uri.authority;
                if (folder.uri.query) {
                    try {
                        const params = new URLSearchParams(folder.uri.query);
                        const csrf = params.get("csrf");
                        if (csrf) globalCsrfToken = csrf;
                        const origin = params.get("origin");
                        if (origin) globalOrigin = origin;
                        const s = params.get("server");
                        if (s) globalServerUuid = s;
                    } catch (e) {}
                }
            }
        }
    };
    updateWorkspaceInfo();
    if (vscode.workspace.onDidChangeWorkspaceFolders) {
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(updateWorkspaceInfo));
    }

    const provider = new PterodactylFileSystemProvider();
    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider("ptero", provider, {
            isCaseSensitive: true,
            isReadonly: false
        })
    );
    console.log("[PteroFS] Pterodactyl FileSystem Provider successfully registered for ptero://");
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
