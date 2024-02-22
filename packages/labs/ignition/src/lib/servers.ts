/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import cors from 'koa-cors';
import type {AbsolutePath, Analyzer} from '@lit-labs/analyzer';
import {createPackageAnalyzer} from '@lit-labs/analyzer/package-analyzer.js';
import type {Server} from 'http';
import {startServer} from './project-server.js';
import * as path from 'node:path';
import {DevServer} from './types.cjs';
import type {AddressInfo} from 'net';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
import wds = require('@web/dev-server');
import vscode = require('vscode');

// Map of workspace folder to dev server and analyzer. This allows very fast
// re-opening of a previous "Ignition" webview. Currently this map leaks, and is
// only cleared by refreshing vscode.
const workspaceResourcesCache = new Map<
  string,
  {server: Server; analyzer: Analyzer}
>();

const uiRoot = path.dirname(require.resolve('@lit-labs/ignition-ui'));
let uiServerPromise: Promise<DevServer>;

export const ensureUiServerRunning = async () => {
  return (uiServerPromise ??= wds.startDevServer({
    config: {
      rootDir: path.join(uiRoot),
      middleware: [cors({origin: '*', credentials: true})],
    },
    readCliArgs: false,
    readFileConfig: false,
  }));
};

export const getWorkspaceResources = async (
  workspaceFolder: vscode.WorkspaceFolder
) => {
  let workspaceResources = workspaceResourcesCache.get(
    workspaceFolder.uri.fsPath
  );
  if (workspaceResources === undefined) {
    const analyzer = createPackageAnalyzer(
      workspaceFolder!.uri.fsPath as AbsolutePath
    );

    const uiServer = await ensureUiServerRunning();
    const uiServerAddress = uiServer.server?.address() as AddressInfo;

    const server = await startServer(uiServerAddress.port, analyzer);

    workspaceResources = {server, analyzer};
    workspaceResourcesCache.set(workspaceFolder.uri.fsPath, workspaceResources);
  }
  return workspaceResources;
};
