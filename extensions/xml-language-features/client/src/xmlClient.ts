/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	ExtensionContext, Position, TextDocument, Range, CompletionItem, CompletionContext, CompletionList,
	Disposable, CancellationToken, ProviderResult, window, l10n,
	LogOutputChannel
} from 'vscode';
import {
	LanguageClientOptions, ProvideCompletionItemsSignature, BaseLanguageClient
} from 'vscode-languageclient';
import { FileSystemProvider, serveFileSystemRequests } from './requests';
import TelemetryReporter from '@vscode/extension-telemetry';

export type LanguageClientConstructor = (id: string, name: string, clientOptions: LanguageClientOptions) => BaseLanguageClient;

export interface Runtime {
	TextDecoder: typeof TextDecoder;
	fileFs?: FileSystemProvider;
	telemetry?: TelemetryReporter;
	readonly timer: {
		setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): Disposable;
	};
}

export interface AsyncDisposable {
	dispose(): Promise<void>;
}

export async function startClient(_context: ExtensionContext, newLanguageClient: LanguageClientConstructor, runtime: Runtime): Promise<AsyncDisposable> {

	const toDispose: Disposable[] = [];
	const languageServerDescription = l10n.t('XML Language Server');
	const logOutputChannel: LogOutputChannel = window.createOutputChannel(languageServerDescription, { log: true });
	toDispose.push(logOutputChannel);

	const documentSelector = [
		{ scheme: 'file', language: 'xml' },
		{ scheme: 'file', language: 'xsl' },
		{ scheme: 'untitled', language: 'xml' },
		{ scheme: 'untitled', language: 'xsl' }
	];

	let client: BaseLanguageClient | undefined = undefined;

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector,
		synchronize: {
			configurationSection: ['xml'], // the settings to synchronize
		},
		initializationOptions: {
			handledSchemas: ['file'],
			provideFormatter: true, // tell the server to provide formatting capability
			customCapabilities: { rangeFormatting: { editLimit: 10000 } }
		},
		middleware: {
			// testing the replace / insert mode
			provideCompletionItem(document: TextDocument, position: Position, context: CompletionContext, token: CancellationToken, next: ProvideCompletionItemsSignature): ProviderResult<CompletionItem[] | CompletionList> {
				function updateRanges(item: CompletionItem) {
					const range = item.range;
					if (range instanceof Range && range.end.isAfter(position) && range.start.isBeforeOrEqual(position)) {
						item.range = { inserting: new Range(range.start, position), replacing: range };
					}
				}
				function updateProposals(r: CompletionItem[] | CompletionList | null | undefined): CompletionItem[] | CompletionList | null | undefined {
					if (r) {
						(Array.isArray(r) ? r : r.items).forEach(updateRanges);
					}
					return r;
				}
				const isThenable = <T>(obj: ProviderResult<T>): obj is Thenable<T> => obj && (<any>obj)['then'];

				const r = next(document, position, context, token);
				if (isThenable<CompletionItem[] | CompletionList | null | undefined>(r)) {
					return r.then(updateProposals);
				}
				return updateProposals(r);
			}
		}
	};
	clientOptions.outputChannel = logOutputChannel;

	// Create the language client and start the client.
	client = newLanguageClient('xml', languageServerDescription, clientOptions);
	client.registerProposedFeatures();

	await client.start();

	toDispose.push(serveFileSystemRequests(client, runtime));

	return {
		dispose: async () => {
			await Promise.all(toDispose.map(d => {
				try {
					return d.dispose();
				} catch (e) {
					logOutputChannel.error(String(e));
				}
			}));
			if (client) {
				await client.dispose();
			}
			logOutputChannel.dispose();
		}
	};
}