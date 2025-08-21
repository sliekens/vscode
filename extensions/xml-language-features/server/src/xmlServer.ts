/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Connection, TextDocuments, InitializeParams, InitializeResult, RequestType,
	ServerCapabilities, DidChangeWorkspaceFoldersNotification,
	TextDocumentSyncKind, FormattingOptions, TextEdit
} from 'vscode-languageserver';
import { TextDocument, Range } from 'vscode-languageserver-textdocument';

export interface Settings {
	xml?: {
		format?: {
			enable?: boolean;
			wrapLineLength?: number;
			preserveNewLines?: boolean;
			maxPreserveNewLines?: number | null;
			indentInnerXml?: boolean;
			wrapAttributes?: string;
			wrapAttributesIndentSize?: number | null;
			unformattedContentDelimiter?: string;
		};
		suggest?: {
			enabled?: boolean;
		};
		validate?: {
			enabled?: boolean;
		};
		autoClosingTags?: boolean;
		hover?: {
			documentation?: boolean;
		};
	};
}

export interface FileSystemProvider {
	stat(uri: string): Promise<FileStat>;
	readDirectory(uri: string): Promise<[string, FileType][]>;
}

export enum FileType {
	Unknown = 0,
	File = 1,
	Directory = 2,
	SymbolicLink = 64
}

export interface FileStat {
	type: FileType;
	ctime: number;
	mtime: number;
	size: number;
}

namespace FsStatRequest {
	export const type: RequestType<string, FileStat, any> = new RequestType('fs/stat');
}

namespace FsReadDirRequest {
	export const type: RequestType<string, [string, FileType][], any> = new RequestType('fs/readDir');
}

let connection: Connection | undefined;
let documents: TextDocuments<TextDocument> | undefined;
let workspaceFolders: any[] = [];
let globalSettings: Settings = {};
let documentSettings: { [key: string]: Thenable<Settings> } = {};

export function startServer(connectionParam: Connection) {
	connection = connectionParam;
	documents = new TextDocuments(TextDocument);

	const hasConfigurationCapability = false;
	const hasWorkspaceFolderCapability = false;

	connection.onInitialize((params: InitializeParams): InitializeResult => {
		// Store workspace folders
		if (params.workspaceFolders) {
			workspaceFolders = params.workspaceFolders;
		}

		return {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Incremental,
				documentFormattingProvider: true,
				documentRangeFormattingProvider: true,
				completionProvider: {
					resolveProvider: false,
					triggerCharacters: ['<', '!', '.', ':', '</', '=', '"', "'"]
				},
				hoverProvider: true,
				documentSymbolProvider: true,
				definitionProvider: false,
				documentLinkProvider: {
					resolveProvider: false
				},
				foldingRangeProvider: true
			} satisfies ServerCapabilities
		};
	});

	connection.onInitialized(() => {
		if (hasConfigurationCapability) {
			// Register for all configuration changes.
			connection!.client.register(DidChangeWorkspaceFoldersNotification.type, undefined);
		}
		if (hasWorkspaceFolderCapability) {
			connection!.workspace.onDidChangeWorkspaceFolders(_event => {
				workspaceFolders = _event.added.concat(workspaceFolders.filter(folder => !_event.removed.find(removedFolder => removedFolder.uri === folder.uri)));
			});
		}
	});

	connection.onDidChangeConfiguration(change => {
		if (hasConfigurationCapability) {
			// Reset all cached document settings
			documentSettings = {};
		} else {
			globalSettings = <Settings>(change.settings.xml || {});
		}

		// Revalidate all open text documents
		documents!.all().forEach(validateTextDocument);
	});

	function getDocumentSettings(resource: string): Thenable<Settings> {
		if (!hasConfigurationCapability) {
			return Promise.resolve(globalSettings);
		}
		let result = documentSettings[resource];
		if (!result) {
			result = connection!.workspace.getConfiguration({
				scopeUri: resource,
				section: 'xml'
			});
			documentSettings[resource] = result;
		}
		return result;
	}

	// Only keep settings for open documents
	documents.onDidClose(e => {
		delete documentSettings[e.document.uri];
	});

	// The content of a text document has changed. This event is emitted
	// when the text document first opened or when its content has changed.
	documents.onDidChangeContent(change => {
		validateTextDocument(change.document);
	});

	async function validateTextDocument(textDocument: TextDocument): Promise<void> {
		// In a real server this would run the document through a validator
		// For now we'll just clear any diagnostics
		const settings = await getDocumentSettings(textDocument.uri);
		
		if (settings.xml?.validate?.enabled === false) {
			return;
		}

		const diagnostics: any[] = [];
		connection!.sendDiagnostics({ uri: textDocument.uri, diagnostics });
	}

	connection.onDocumentFormatting(async (params) => {
		const document = documents!.get(params.textDocument.uri);
		if (!document) {
			return [];
		}

		const settings = await getDocumentSettings(params.textDocument.uri);
		if (settings.xml?.format?.enable === false) {
			return [];
		}

		return formatXmlDocument(document, params.options, settings);
	});

	connection.onDocumentRangeFormatting(async (params) => {
		const document = documents!.get(params.textDocument.uri);
		if (!document) {
			return [];
		}

		const settings = await getDocumentSettings(params.textDocument.uri);
		if (settings.xml?.format?.enable === false) {
			return [];
		}

		return formatXmlDocumentRange(document, params.range, params.options, settings);
	});

	// File system request handlers
	connection.onRequest(FsStatRequest.type, (_uriString: string) => {
		// For now, just return a simple stat for files
		return Promise.resolve({
			type: FileType.File,
			ctime: Date.now(),
			mtime: Date.now(),
			size: 0
		});
	});

	connection.onRequest(FsReadDirRequest.type, (_uriString: string) => {
		// For now, return empty directory
		return Promise.resolve([]);
	});

	// Make the text document manager listen on the connection
	// for open, change and close text document events
	documents.listen(connection);

	// Listen on the connection
	connection.listen();
}

function formatXmlDocument(document: TextDocument, options: FormattingOptions, settings: Settings): TextEdit[] {
	const text = document.getText();
	const formatted = formatXml(text, options, settings);
	
	if (formatted === text) {
		return [];
	}

	return [{
		range: {
			start: document.positionAt(0),
			end: document.positionAt(text.length)
		},
		newText: formatted
	}];
}

function formatXmlDocumentRange(document: TextDocument, range: Range, options: FormattingOptions, settings: Settings): TextEdit[] {
	const text = document.getText(range);
	const formatted = formatXml(text, options, settings);
	
	if (formatted === text) {
		return [];
	}

	return [{
		range,
		newText: formatted
	}];
}

function formatXml(content: string, options: FormattingOptions, settings: Settings): string {
	const xmlSettings = settings.xml?.format || {};
	const indentSize = options.tabSize || 2;
	const useSpaces = options.insertSpaces !== false;
	const indentChar = useSpaces ? ' '.repeat(indentSize) : '\t';

	// Simple XML formatter
	let formatted = '';
	let depth = 0;
	let preserveWhitespace = false;

	const lines = content.split(/\r?\n/);
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]?.trim() || '';
		
		if (!line) {
			if (xmlSettings.preserveNewLines !== false) {
				formatted += '\n';
			}
			continue;
		}

		// Handle XML declarations and comments
		if (line.startsWith('<?') || line.startsWith('<!--')) {
			formatted += line + '\n';
			continue;
		}

		// Handle CDATA sections
		if (line.includes('<![CDATA[')) {
			preserveWhitespace = true;
			formatted += indentChar.repeat(depth) + line + '\n';
			if (line.includes(']]>')) {
				preserveWhitespace = false;
			}
			continue;
		}

		if (preserveWhitespace) {
			formatted += line + '\n';
			if (line.includes(']]>')) {
				preserveWhitespace = false;
			}
			continue;
		}

		// Handle self-closing tags
		if (line.includes('/>')) {
			formatted += indentChar.repeat(depth) + line + '\n';
			continue;
		}

		// Handle closing tags
		if (line.startsWith('</')) {
			depth = Math.max(0, depth - 1);
			formatted += indentChar.repeat(depth) + line + '\n';
			continue;
		}

		// Handle opening tags
		if (line.startsWith('<') && !line.startsWith('<!')) {
			formatted += indentChar.repeat(depth) + line + '\n';
			// Check if this opens a new tag (not self-closing)
			if (!line.endsWith('/>')) {
				depth++;
			}
			continue;
		}

		// Handle text content
		if (line && !line.startsWith('<')) {
			formatted += indentChar.repeat(depth) + line + '\n';
			continue;
		}

		// Default case
		formatted += indentChar.repeat(depth) + line + '\n';
	}

	return formatted.trimEnd();
}