/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { startServer } from '../xmlServer';

// Create a connection for the server. The connection uses Node's IPC as a transport.
const connection = createConnection(ProposedFeatures.all);

startServer(connection);