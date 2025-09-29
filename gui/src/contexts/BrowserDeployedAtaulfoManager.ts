// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  type DeployedAtaulfoAPI,
  AtaulfoAPI,
  type AtaulfoProviders,
  type AtaulfoCircuitKeys,
} from '../../../api/src/index';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import {
  BehaviorSubject,
  type Observable,
  concatMap,
  filter,
  firstValueFrom,
  interval,
  map,
  of,
  take,
  tap,
  throwError,
  timeout,
  catchError,
} from 'rxjs';
import { pipe as fnPipe } from 'fp-ts/function';
import { type Logger } from 'pino';
import {
  type DAppConnectorAPI,
  type DAppConnectorWalletAPI,
  type ServiceUriConfig,
} from '@midnight-ntwrk/dapp-connector-api';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import {
  type BalancedTransaction,
  type UnbalancedTransaction,
  createBalancedTx,
} from '@midnight-ntwrk/midnight-js-types';
import { type CoinInfo, Transaction, type TransactionId } from '@midnight-ntwrk/ledger';
import { Transaction as ZswapTransaction } from '@midnight-ntwrk/zswap';
import semver from 'semver';
import { getLedgerNetworkId, getZswapNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

/**
 * A fresh new Ataulfo deployment instance.
 */
export interface InitAtaulfoDeployment {
  readonly status: 'init';
}

/**
 * An in-progress Ataulfo deployment.
 */
export interface InProgressAtaulfoDeployment {
  readonly status: 'in-progress';
}

/**
 * A deployed Ataulfo deployment.
 */
export interface DeployedAtaulfoDeployment {
  readonly status: 'deployed';

  /**
   * The {@link DeployedAtaulfoAPI} instance when connected to an on network Ataulfo contract.
   */
  readonly api: DeployedAtaulfoAPI;
}

/**
 * A failed Ataulfo deployment.
 */
export interface FailedAtaulfoDeployment {
  readonly status: 'failed';

  /**
   * The error that caused the deployment to fail.
   */
  readonly error: Error;
}

/**
 * A Ataulfo deployment.
 */
export type AtaulfoDeployment = InitAtaulfoDeployment | InProgressAtaulfoDeployment | DeployedAtaulfoDeployment | FailedAtaulfoDeployment;

/**
 * Provides access to an Ataulfo deployment.
 */
export interface DeployedAtaulfoAPIProvider {
  /**
   * Gets the observable Ataulfo deployment.
   *
   * @remarks
   * This property represents an observable {@link AtaulfoDeployment}.
   */
  readonly ataulfoDeployment$: Observable<Observable<AtaulfoDeployment>>;

  /**
   * Resets it to the initial state.
   */
  readonly reset: () => Observable<AtaulfoDeployment>;

  /**
   * Joins an Ataulfo contract.
   *
   * @param contractAddress A contract address to use when resolving.
   * @param accountPassword A password for the account.
   * @returns An observable Ataulfo deployment.
   */
  readonly resolve: (contractAddress: ContractAddress, accountPassword: Uint8Array) => Observable<AtaulfoDeployment>;

  /**
   * Creates a new Ataulfo contract.
   *
   * @param assetName Name of the NFT create for the assets.
   * @param assetSymbol Symbol of the NFT created for the assets.
   * @param opsFee Fee the contract will charge for each operation.
   * @param accountPassword A password for the account.
   * @returns An observable Ataulfo deployment.
   */
  readonly create: (assetUri: string, opsFee: bigint, accountPassword: Uint8Array) => Observable<AtaulfoDeployment>;
}

/**
 * A {@link DeployedAtaulfoAPIProvider} that manages Ataulfo deployments in a browser setting.
 *
 * @remarks
 * {@link BrowserDeployedAtaulfoManager} configures and manages a connection to the Midnight Lace
 * wallet, along with a collection of additional providers that work in a web-browser setting.
 */
export class BrowserDeployedAtaulfoManager implements DeployedAtaulfoAPIProvider {
  readonly #ataulfoDeploymentsSubject: BehaviorSubject<BehaviorSubject<AtaulfoDeployment>>;
  #initializedProviders: Promise<AtaulfoProviders> | undefined;

  /**
   * Initializes a new {@link BrowserDeployedAtaulfoManager} instance.
   *
   * @param logger The `pino` logger to for logging.
   */
  constructor(private readonly logger: Logger) {
    this.#ataulfoDeploymentsSubject = new BehaviorSubject<BehaviorSubject<AtaulfoDeployment>>(
      new BehaviorSubject<AtaulfoDeployment>({ status: 'init' })
    );
    this.ataulfoDeployment$ = this.#ataulfoDeploymentsSubject;
  }

  reset(): Observable<AtaulfoDeployment> {
    let deployment = new BehaviorSubject<AtaulfoDeployment>({
      status: 'init',
    });

    this.#ataulfoDeploymentsSubject.next(deployment);

    return deployment;
  }

  /** @inheritdoc */
  readonly ataulfoDeployment$: Observable<Observable<AtaulfoDeployment>>;

  /** @inheritdoc */
  resolve(contractAddress: ContractAddress, accountPassword: Uint8Array): Observable<AtaulfoDeployment> {
    let deployment = this.#ataulfoDeploymentsSubject.value;
    if (deployment.value.status === 'deployed' && deployment.value.api.deployedContractAddress === contractAddress) {
      return deployment;
    };

    deployment = new BehaviorSubject<AtaulfoDeployment>({
      status: 'in-progress',
    });

    void this.joinDeployment(deployment, contractAddress, accountPassword);

    this.#ataulfoDeploymentsSubject.next(deployment);

    return deployment;
  }

  /** @inheritdoc */
  create(assetUri: string, opsFee: bigint, accountPassword: Uint8Array): Observable<AtaulfoDeployment> {
    let deployment = new BehaviorSubject<AtaulfoDeployment>({
      status: 'in-progress',
    });

    void this.deployDeployment(deployment, assetUri, opsFee, accountPassword);

    this.#ataulfoDeploymentsSubject.next(deployment);

    return deployment;
  }


  private getProviders(): Promise<AtaulfoProviders> {
    // We use a cached `Promise` to hold the providers. This will:
    //
    // 1. Cache and re-use the providers (including the configured connector API), and
    // 2. Act as a synchronization point if multiple contract deploys or joins run concurrently.
    //    Concurrent calls to `getProviders()` will receive, and ultimately await, the same
    //    `Promise`.
    return this.#initializedProviders ?? (this.#initializedProviders = initializeProviders(this.logger));
  }

  private async deployDeployment(deployment: BehaviorSubject<AtaulfoDeployment>, assetUri: string, opsFee: bigint, accountPassword: Uint8Array): Promise<void> {
    try {
      const providers = await this.getProviders();

      const api = await AtaulfoAPI.deploy(providers, assetUri, accountPassword, opsFee, this.logger);

      deployment.next({
        status: 'deployed',
        api,
      });
    } catch (error: unknown) {
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  private async joinDeployment(
    deployment: BehaviorSubject<AtaulfoDeployment>,
    contractAddress: ContractAddress,
    accountPassword: Uint8Array
  ): Promise<void> {
    try {
      const providers = await this.getProviders();

      const api = await AtaulfoAPI.join(providers, contractAddress, accountPassword, this.logger);

      deployment.next({
        status: 'deployed',
        api,
      });
    } catch (error: unknown) {
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

/** @internal */
const initializeProviders = async (logger: Logger): Promise<AtaulfoProviders> => {
  const { wallet, uris } = await connectToWallet(logger);
  const walletState = await wallet.state();
  const zkConfigPath = window.location.origin; // '../../../contract/src/managed/ataulfo';

  console.log(`Connecting to wallet with network ID: ${getLedgerNetworkId()}`);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'ataulfo-private-state',
    }),
    zkConfigProvider: new FetchZkConfigProvider<AtaulfoCircuitKeys>(zkConfigPath, fetch.bind(window)),
    proofProvider: httpClientProofProvider(uris.proverServerUri),
    publicDataProvider: indexerPublicDataProvider(uris.indexerUri, uris.indexerWsUri),
    walletProvider: {
      coinPublicKey: walletState.coinPublicKey,
      encryptionPublicKey: walletState.encryptionPublicKey,
      balanceTx(tx: UnbalancedTransaction, newCoins: CoinInfo[]): Promise<BalancedTransaction> {
        return wallet
          .balanceAndProveTransaction(
            ZswapTransaction.deserialize(tx.serialize(getLedgerNetworkId()), getZswapNetworkId()),
            newCoins,
          )
          .then((zswapTx) => Transaction.deserialize(zswapTx.serialize(getZswapNetworkId()), getLedgerNetworkId()))
          .then(createBalancedTx);
      },
    },
    midnightProvider: {
      submitTx(tx: BalancedTransaction): Promise<TransactionId> {
        return wallet.submitTransaction(tx);
      },
    },
  };
};

/** @internal */
const connectToWallet = (logger: Logger): Promise<{ wallet: DAppConnectorWalletAPI; uris: ServiceUriConfig }> => {
  const COMPATIBLE_CONNECTOR_API_VERSION = '1.x';

  return firstValueFrom(
    fnPipe(
      interval(100),
      map(() => window.midnight?.mnLace),
      tap((connectorAPI) => {
        logger.info(connectorAPI, 'Check for wallet connector API');
      }),
      filter((connectorAPI): connectorAPI is DAppConnectorAPI => !!connectorAPI),
      concatMap((connectorAPI) =>
        semver.satisfies(connectorAPI.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION)
          ? of(connectorAPI)
          : throwError(() => {
            logger.error(
              {
                expected: COMPATIBLE_CONNECTOR_API_VERSION,
                actual: connectorAPI.apiVersion,
              },
              'Incompatible version of wallet connector API',
            );

            return new Error(
              `Incompatible version of Midnight Lace wallet found. Require '${COMPATIBLE_CONNECTOR_API_VERSION}', got '${connectorAPI.apiVersion}'.`,
            );
          }),
      ),
      tap((connectorAPI) => {
        logger.info(connectorAPI, 'Compatible wallet connector API found. Connecting.');
      }),
      take(1),
      timeout({
        first: 1_000,
        with: () =>
          throwError(() => {
            logger.error('Could not find wallet connector API');

            return new Error('Could not find Midnight Lace wallet. Extension installed?');
          }),
      }),
      concatMap(async (connectorAPI) => {
        const isEnabled = await connectorAPI.isEnabled();

        logger.info(isEnabled, 'Wallet connector API enabled status');

        return connectorAPI;
      }),
      timeout({
        first: 5_000,
        with: () =>
          throwError(() => {
            logger.error('Wallet connector API has failed to respond');

            return new Error('Midnight Lace wallet has failed to respond. Extension enabled?');
          }),
      }),
      concatMap(async (connectorAPI) => ({ walletConnectorAPI: await connectorAPI.enable(), connectorAPI })),
      catchError((error, apis) =>
        error
          ? throwError(() => {
            logger.error('Unable to enable connector API');
            return new Error('Application is not authorized');
          })
          : apis,
      ),
      concatMap(async ({ walletConnectorAPI, connectorAPI }) => {
        const uris = await connectorAPI.serviceUriConfig();

        logger.info('Connected to wallet connector API and retrieved service configuration');

        return { wallet: walletConnectorAPI, uris };
      }),
    ),
  );
};
