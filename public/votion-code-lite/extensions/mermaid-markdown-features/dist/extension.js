"use strict";var q=Object.create;var _=Object.defineProperty;var J=Object.getOwnPropertyDescriptor;var V=Object.getOwnPropertyNames;var Y=Object.getPrototypeOf,G=Object.prototype.hasOwnProperty;var K=(e,i)=>{for(var r in i)_(e,r,{get:i[r],enumerable:!0})},z=(e,i,r,t)=>{if(i&&typeof i=="object"||typeof i=="function")for(let n of V(i))!G.call(e,n)&&n!==r&&_(e,n,{get:()=>i[n],enumerable:!(t=J(i,n))||t.enumerable});return e};var I=(e,i,r)=>(r=e!=null?q(Y(e)):{},z(i||!e||!e.__esModule?_(r,"default",{value:e,enumerable:!0}):r,e)),Q=e=>z(_({},"__esModule",{value:!0}),e);var me={};K(me,{activate:()=>ce});module.exports=Q(me);var u=I(require("vscode"));var c=I(require("vscode"));function C(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function y(){if(typeof crypto.randomUUID=="function")return crypto.randomUUID.bind(crypto)();let e=new Uint8Array(16),i=[];for(let n=0;n<256;n++)i.push(n.toString(16).padStart(2,"0"));crypto.getRandomValues(e),e[6]=e[6]&15|64,e[8]=e[8]&63|128;let r=0,t="";return t+=i[e[r++]],t+=i[e[r++]],t+=i[e[r++]],t+=i[e[r++]],t+="-",t+=i[e[r++]],t+=i[e[r++]],t+="-",t+=i[e[r++]],t+=i[e[r++]],t+="-",t+=i[e[r++]],t+=i[e[r++]],t+="-",t+=i[e[r++]],t+=i[e[r++]],t+=i[e[r++]],t+=i[e[r++]],t+=i[e[r++]],t+=i[e[r++]],t}function T(e){for(;e.length;)e.pop()?.dispose()}var M=class{_isDisposed=!1;_disposables=[];dispose(){this._isDisposed||(this._isDisposed=!0,T(this._disposables))}_register(i){return this._isDisposed?i.dispose():this._disposables.push(i),i}get isDisposed(){return this._isDisposed}};var A=I(require("vscode")),b="markdown-mermaid";var X="vscode",ee=["vscode","base","forest","dark","default","neutral"];function O(e){return typeof e=="string"&&ee.includes(e)?e:X}function ie(){let e=A.workspace.getConfiguration(b);return{darkModeTheme:O(e.get("darkModeTheme")),lightModeTheme:O(e.get("lightModeTheme")),maxTextSize:e.get("maxTextSize"),clickDrag:e.get("mouseNavigation.enabled","alt"),showControls:e.get("controls.show","onHoverOrFocus"),resizable:e.get("resizable",!0),maxHeight:e.get("maxHeight","")}}function j(e){let i=e.renderer.render;return e.renderer.render=function(...r){return`${k()}
				${i.apply(e.renderer,r)}`},e}function k(){let e=re(JSON.stringify(ie()));return`<span id="${b}" aria-hidden="true" data-config="${e}"></span>`}function re(e){return e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}var te="text/vnd.mermaid",oe="vscode.mermaid-markdown-features.chatOutputItem",$=class{constructor(i,r){this._extensionUri=i;this._webviewManager=r}_extensionUri;_webviewManager;async renderChatOutput({value:i},r,t,n){let o=r.webview,s=ae(i),l=s.source,v=s.title,a=y(),w=[];w.push(this._webviewManager.registerWebview(a,o,l,v,"chat")),w.push(o.onDidReceiveMessage(p=>{p.type==="openInEditor"&&c.commands.executeCommand("_mermaid-markdown.openInEditor",{mermaidWebviewId:a})})),r.onDidDispose(()=>{T(w)});let m=c.Uri.joinPath(this._extensionUri,"chat-webview-out");o.options={enableScripts:!0,localResourceRoots:[m]};let g=y(),x=c.Uri.joinPath(m,"index.js"),D=o.asWebviewUri(c.Uri.joinPath(m,"codicon.css")),h=c.l10n.t("Open Diagram in Editor");o.html=`
			<!DOCTYPE html>
			<html lang="en">

			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Mermaid Diagram</title>
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; script-src 'nonce-${g}'; style-src ${o.cspSource} 'unsafe-inline'; font-src data:;" />
				<link rel="stylesheet" type="text/css" href="${D}">

				<style>
					body {
						padding: 0;
					}
					.mermaid {
						visibility: hidden;
					}
					.mermaid.rendered {
						visibility: visible;
					}
					.open-in-editor-btn {
						position: absolute;
						top: 8px;
						right: 8px;
						display: flex;
						align-items: center;
						justify-content: center;
						width: 26px;
						height: 26px;
						background: var(--vscode-editorWidget-background);
						color: var(--vscode-icon-foreground);
						border: 1px solid var(--vscode-editorWidget-border);
						border-radius: 6px;
						cursor: pointer;
						z-index: 100;
						opacity: 0;
						transition: opacity 0.2s;
					}
					body:hover .open-in-editor-btn,
					.open-in-editor-btn:focus {
						opacity: 1;
					}
					.open-in-editor-btn:hover {
						opacity: 1;
						background: var(--vscode-toolbar-hoverBackground);
					}
				</style>
			</head>

			<body data-vscode-context='${JSON.stringify({preventDefaultContextMenuItems:!0,mermaidWebviewId:a})}' data-vscode-mermaid-webview-id="${a}">
				${k()}
				<button class="open-in-editor-btn" title="${h}" aria-label="${h}"><i class="codicon codicon-open-preview" aria-hidden="true"></i></button>
				<pre class="mermaid">
					${C(l)}
				</pre>

				<script type="module" nonce="${g}" src="${o.asWebviewUri(x)}"></script>
			</body>
			</html>`}};function L(e,i,r){let t=[];t.push(c.commands.registerCommand("_mermaid-markdown.openInEditor",o=>{if(typeof o?.mermaidSource=="string"){r.openPreview(o.mermaidSource,typeof o.title=="string"?o.title:void 0);return}let s=o?.mermaidWebviewId?i.getWebview(o.mermaidWebviewId):i.activeWebview;s&&r.openPreview(s.mermaidSource,s.title)})),t.push(c.lm.registerTool("renderMermaidDiagram",{invoke:async(o,s)=>{let l=o.input.markup,v=o.input.title;return ne(l,v)}}));let n=new $(e.extensionUri,i);return t.push(c.chat.registerChatOutputRenderer(oe,n)),c.Disposable.from(...t)}function ne(e,i){let r=se(e),t=new c.LanguageModelToolResult([new c.LanguageModelTextPart(`${r}mermaid
${e}
${r}`)]),n=JSON.stringify({source:e,title:i});return t.toolResultDetails2={mime:te,value:new TextEncoder().encode(n)},t}function se(e){let i=e.matchAll(/`+/g);if(!i)return"```";let r=Math.max(...Array.from(i,t=>t[0].length));return"`".repeat(Math.max(3,r+1))}function ae(e){let i=new TextDecoder().decode(e);try{let r=JSON.parse(i);if(typeof r=="object"&&typeof r.source=="string")return{title:r.title,source:r.source}}catch{}return{title:void 0,source:i}}var d=I(require("vscode"));var H="vscode.mermaid-markdown-features.preview",W=class extends M{constructor(r,t){super();this._extensionUri=r;this._webviewManager=t;this._register(d.window.registerWebviewPanelSerializer(H,this))}_extensionUri;_webviewManager;_previews=new Map;openPreview(r,t){let n=R(r),o=this._previews.get(n);if(o){o.reveal();return}let s=P.create(n,r,t,this._extensionUri,this._webviewManager,d.ViewColumn.Active);this._registerPreview(s)}async deserializeWebviewPanel(r,t){if(!t?.mermaidSource){r.webview.html=this._getErrorHtml();return}let n=R(t.mermaidSource),o=P.revive(r,n,t.mermaidSource,this._extensionUri,this._webviewManager);this._registerPreview(o)}_registerPreview(r){this._previews.set(r.diagramId,r),r.onDispose(()=>{this._previews.delete(r.diagramId)})}_getErrorHtml(){return`<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Mermaid Preview</title>
				<meta http-equiv="Content-Security-Policy" content="default-src 'none';">
				<style>
					body {
						display: flex;
						justify-content: center;
						align-items: center;
						height: 100vh;
						margin: 0;
					}
				</style>
			</head>
			<body>
				<p>An unexpected error occurred while restoring the Mermaid preview.</p>
			</body>
			</html>`}dispose(){super.dispose();for(let r of this._previews.values())r.dispose();this._previews.clear()}},P=class e extends M{constructor(r,t,n,o,s){super();this._webviewPanel=r;this.diagramId=t;this._mermaidSource=n;this._extensionUri=o;this._webviewManager=s;this._webviewPanel.iconPath=new d.ThemeIcon("graph"),this._webviewPanel.webview.options={enableScripts:!0,localResourceRoots:[d.Uri.joinPath(this._extensionUri,"chat-webview-out")]},this._webviewPanel.webview.html=this._getHtml(),this._register(this._webviewManager.registerWebview(this.diagramId,this._webviewPanel.webview,this._mermaidSource,void 0,"editor")),this._register(this._webviewPanel.onDidChangeViewState(l=>{l.webviewPanel.active&&this._webviewManager.setActiveWebview(this.diagramId)})),this._register(this._webviewPanel.onDidDispose(()=>{this._onDisposeEmitter.fire(),this.dispose()}))}_webviewPanel;diagramId;_mermaidSource;_extensionUri;_webviewManager;_onDisposeEmitter=this._register(new d.EventEmitter);onDispose=this._onDisposeEmitter.event;static create(r,t,n,o,s,l){let v=d.window.createWebviewPanel(H,n??d.l10n.t("Mermaid Diagram"),l,{retainContextWhenHidden:!1});return new e(v,r,t,o,s)}static revive(r,t,n,o,s){return new e(r,t,n,o,s)}reveal(){this._webviewPanel.reveal()}dispose(){this._onDisposeEmitter.fire(),super.dispose(),this._webviewPanel.dispose()}_getHtml(){let r=y(),t=d.Uri.joinPath(this._extensionUri,"chat-webview-out"),n=this._webviewPanel.webview.asWebviewUri(d.Uri.joinPath(t,"index-editor.js")),o=this._webviewPanel.webview.asWebviewUri(d.Uri.joinPath(t,"codicon.css")),s=d.l10n.t("Toggle Pan Mode"),l=d.l10n.t("Zoom Out"),v=d.l10n.t("Zoom In"),a=d.l10n.t("Reset Pan and Zoom");return`<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Mermaid Diagram</title>
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; script-src 'nonce-${r}'; style-src ${this._webviewPanel.webview.cspSource} 'unsafe-inline'; font-src data:;" />
				<link rel="stylesheet" type="text/css" href="${o}">
				<style>
					html, body {
						margin: 0;
						padding: 0;
						height: 100%;
						width: 100%;
						overflow: hidden;
					}
					.mermaid {
						visibility: hidden;
					}
					.mermaid.rendered {
						visibility: visible;
					}
					.mermaid-wrapper {
						height: 100%;
						width: 100%;
					}
					.zoom-controls {
						position: absolute;
						top: 8px;
						right: 8px;
						display: flex;
						gap: 2px;
						z-index: 100;
						background: var(--vscode-editorWidget-background);
						border: 1px solid var(--vscode-editorWidget-border);
						border-radius: 6px;
						padding: 3px;
					}
					.zoom-controls button {
						display: flex;
						align-items: center;
						justify-content: center;
						width: 26px;
						height: 26px;
						background: transparent;
						color: var(--vscode-icon-foreground);
						border: none;
						border-radius: 4px;
						cursor: pointer;
					}
					.zoom-controls button:hover {
						background: var(--vscode-toolbar-hoverBackground);
					}
					.zoom-controls button.active {
						background: var(--vscode-toolbar-activeBackground);
						color: var(--vscode-focusBorder);
					}
				</style>
			</head>
			<body data-vscode-context='${JSON.stringify({preventDefaultContextMenuItems:!0,mermaidWebviewId:this.diagramId})}' data-vscode-mermaid-webview-id="${this.diagramId}">
				${k()}
				<div class="zoom-controls">
					<button class="pan-mode-btn" title="${s}" aria-label="${s}" aria-pressed="false"><i class="codicon codicon-move" aria-hidden="true"></i></button>
					<button class="zoom-out-btn" title="${l}" aria-label="${l}"><i class="codicon codicon-zoom-out" aria-hidden="true"></i></button>
					<button class="zoom-in-btn" title="${v}" aria-label="${v}"><i class="codicon codicon-zoom-in" aria-hidden="true"></i></button>
					<button class="zoom-reset-btn" title="${a}" aria-label="${a}"><i class="codicon codicon-screen-normal" aria-hidden="true"></i></button>
				</div>
				<pre class="mermaid">
					${C(this._mermaidSource)}
				</pre>
				<script type="module" nonce="${r}" src="${n}"></script>
			</body>
			</html>`}};function R(e){let i=0;for(let r=0;r<e.length;r++){let t=e.charCodeAt(r);i=(i<<5)-i+t,i=i&i}return Math.abs(i).toString(16)}var U="mermaid",E="mermaidContainer";function Z(e,i){e.use(t=>{function n(o,s,l,v){let a,w=!1,m=o.bMarks[s]+o.tShift[s],g=o.eMarks[s];if(o.src.charCodeAt(m)!==58)return!1;for(a=m+1;a<=g&&":"[(a-m)%1]===o.src[a];a++);let x=Math.floor((a-m)/1);if(x<3)return!1;a-=(a-m)%1;let D=o.src.slice(m,a),h=o.src.slice(a,g);if(h.trim().split(" ")[0].toLowerCase()!==U)return!1;if(v)return!0;let p=s;for(;p++,!(p>=l||(m=o.bMarks[p]+o.tShift[p],g=o.eMarks[p],m<g&&o.sCount[p]<o.blkIndent));)if(o.src.charCodeAt(m)===58&&!(o.sCount[p]-o.blkIndent>=4)){for(a=m+1;a<=g&&":"[(a-m)%1]===o.src[a];a++);if(!(Math.floor((a-m)/1)<x)&&(a-=(a-m)%1,a=o.skipSpaces(a),!(a<g))){w=!0;break}}let B=o.parentType,N=o.lineMax;o.parentType="container",o.lineMax=p;let f=o.push(E,"div",1);return f.markup=D,f.block=!0,f.info=h,f.map=[s,p],f.content=o.getLines(s+1,p,o.blkIndent,!0),o.parentType=B,o.lineMax=N,o.line=p+(w?1:0),!0}t.block.ruler.before("fence",E,n,{alt:["paragraph","reference","blockquote","list"]}),t.renderer.rules[E]=(o,s)=>{let v=o[s].content;return`<div class="${U}">${F(v)}</div>`}});let r=e.options.highlight;return e.options.highlight=(t,n,o)=>{let s=new RegExp("\\b("+i.languageIds().map(de).join("|")+")\\b","i");return n&&s.test(n)?`<pre class="${U}" style="all: unset;">${F(t)}</pre>`:r?.(t,n,o)??t},e}function F(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n+$/,"").trimStart()}function de(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}var S=class{_activeWebviewId;_webviews=new Map;get activeWebview(){return this._activeWebviewId?this._webviews.get(this._activeWebviewId):void 0}registerWebview(i,r,t,n,o){if(this._webviews.has(i))throw new Error(`Webview with id ${i} is already registered.`);let s={id:i,webview:r,mermaidSource:t,title:n,type:o};return this._webviews.set(i,s),{dispose:()=>this.unregisterWebview(i)}}unregisterWebview(i){this._webviews.delete(i),this._activeWebviewId===i&&(this._activeWebviewId=void 0)}setActiveWebview(i){this._webviews.has(i)&&(this._activeWebviewId=i)}getWebview(i){return this._webviews.get(i)}resetPanZoom(i){(i?this._webviews.get(i):this.activeWebview)?.webview.postMessage({type:"resetPanZoom"})}};function ce(e){let i=new S,r=new W(e.extensionUri,i);return e.subscriptions.push(r),e.subscriptions.push(L(e,i,r)),e.subscriptions.push(u.commands.registerCommand("_mermaid-markdown.resetPanZoom",t=>{i.resetPanZoom(t?.mermaidWebviewId)})),e.subscriptions.push(u.commands.registerCommand("_mermaid-markdown.copySource",t=>{if(typeof t?.mermaidSource=="string"){u.env.clipboard.writeText(t.mermaidSource);return}let n=t?.mermaidWebviewId?i.getWebview(t.mermaidWebviewId):i.activeWebview;n&&u.env.clipboard.writeText(n.mermaidSource)})),e.subscriptions.push(u.workspace.onDidChangeConfiguration(t=>{t.affectsConfiguration(`${b}.languages`)&&u.commands.executeCommand("markdown.api.reloadPlugins"),(t.affectsConfiguration(b)||t.affectsConfiguration("workbench.colorTheme"))&&u.commands.executeCommand("markdown.preview.refresh")})),{extendMarkdownIt(t){return Z(t,{languageIds:()=>u.workspace.getConfiguration(b).get("languages",["mermaid"])}),t.use(j),t}}}0&&(module.exports={activate});
//# sourceMappingURL=extension.js.map
