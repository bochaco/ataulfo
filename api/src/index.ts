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

/**
 * Provides types and utilities for working with Ataulfo contracts.
 *
 * @packageDocumentation
 */

import contractModule, { Offer } from '../../contract/src/managed/ataulfo/contract/index.cjs';
const { Contract, ledger, pureCircuits } = contractModule;

import {
  type ContractAddress, encodeContractAddress,
  dummyContractAddress,
  encodeCoinPublicKey,
} from '@midnight-ntwrk/compact-runtime';
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import { type Logger } from 'pino';
import {
  type AtaulfoDerivedState,
  type AtaulfoContract,
  type AtaulfoProviders,
  type DeployedAtaulfoContract,
  ataulfoPrivateStateKey,
} from './common-types.js';
import { type AtaulfoPrivateState, createAtaulfoPrivateState, witnesses } from '../../contract/src/index';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex, fromHex } from '@midnight-ntwrk/midnight-js-utils';
import { nativeToken, createCoinInfo, encodeCoinInfo } from '@midnight-ntwrk/ledger';

/** @internal */
const ataulfoContractInstance: AtaulfoContract = new Contract(witnesses);

/**
 * An API for a deployed Ataulfo.
 */
export interface DeployedAtaulfoAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<AtaulfoDerivedState>;

  mint: (assetId: bigint, shares: bigint) => Promise<string>;
  withdrawCollectedFees: () => Promise<bigint>;
  createOffer: (assetId: bigint, holdingId: string, shares: bigint, min: bigint, price: bigint, meta: string) => Promise<string>;
  cancelOffer: (offerId: string) => Promise<Offer>;
  depositFunds: (amount: bigint) => Promise<[bigint, bigint]>;
  withdrawFunds: (amount: bigint) => Promise<bigint>;
  balance: () => Promise<bigint>;
  fulfillOffer: (offerId: string, shares: bigint) => Promise<Offer>;
}

/**
 * Provides an implementation of {@link DeployedAtaulfoAPI} by adapting a deployed Ataulfo
 * contract.
 *
 * @remarks
 * The `AtaulfoPrivateState` is managed at the DApp level by a private state provider. As such, this
 * private state is shared between all instances of {@link AtaulfoAPI}, and their underlying deployed
 * contracts. The private state defines a `'secretKey'` property that effectively identifies the current
 * user, and is used to determine if the current user is the owner of the message as the observable
 * contract state changes.
 *
 * In the future, Midnight.js will provide a private state provider that supports private state storage
 * keyed by contract address. This will remove the current workaround of sharing private state across
 * the deployed Ataulfo contracts, and allows for a unique secret key to be generated for each Ataulfo
 * instance that the user interacts with.
 */
export class AtaulfoAPI implements DeployedAtaulfoAPI {
  /** @internal */
  private constructor(
    public readonly deployedContract: DeployedAtaulfoContract,
    providers: AtaulfoProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.state$ = combineLatest(
      [
        // Combine public (ledger) state with...
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => ledger(contractState.data)),
          tap((ledgerState) =>
            logger?.trace({
              ledgerStateChanged: {
                ledgerState: {
                  ...ledgerState,
                  offers: ledgerState.offers,
                  accounts: ledgerState.accounts
                },
              },
            }),
          ),
        ),
        // ...private state...
        //    since the private state of the Ataulfo application never changes, we can query the
        //    private state once and always use the same value with `combineLatest`. In applications
        //    where the private state is expected to change, we would need to make this an `Observable`.
        from(providers.privateStateProvider.get(ataulfoPrivateStateKey) as Promise<AtaulfoPrivateState>),
      ],
      // ...and combine them to produce the required derived state.
      (ledgerState, privateState) => {
        let offers = new Map<string, [Offer, boolean]>();
        let myOffersCount = 0n;
        for (const [id, offer] of ledgerState.offers) {
          const offerId = toHex(id);
          const isMine = offerId == toHex(pureCircuits.genOfferId(privateState.secretKey, offer.holdingId, offer.price));
          if (isMine) {
            myOffersCount += 1n;
          }
          offers.set(offerId, [offer, isMine]);
        }

        const pk = providers.walletProvider.coinPublicKey;
        const hexPk = MidnightBech32m.parse(pk).data.toString('hex');
        const zswap_pk = {
          is_left: true,
          left: { bytes: encodeCoinPublicKey(hexPk) },
          right: { bytes: encodeContractAddress(dummyContractAddress()) }
        };
        const hiddenOwner = pureCircuits.genHiddenOwner(zswap_pk);

        let accounts = new Map<string, bigint>();
        let myBalance = 0n;
        const hiddenOwnerHex = toHex(hiddenOwner);
        for (const [key, balance] of ledgerState.accounts) {
          const balanceOwner = toHex(key);
          if (balanceOwner == hiddenOwnerHex) {
            myBalance = balance;
          }
          accounts.set(balanceOwner, balance);
        }

        let myAssetHoldings = new Map<bigint, [string, bigint]>();
        // FIXME: iterator through the list of asset IDs instead of hard-coded [10, 11, 12]
        for (const i of [10, 11, 12]) {
          const assetId = BigInt(i);
          if (ledgerState.Assets_assetHoldings.member(assetId)) {
            for (const [holdingId, balance] of ledgerState.Assets_assetHoldings.lookup(assetId)) {
              const id = toHex(holdingId);
              if (id == toHex(pureCircuits.Assets_genHoldingId(assetId, hiddenOwner))) {
                myAssetHoldings.set(assetId, [id, balance]);
              }
            }
          }
        }

        const contractOwner = toHex(ledgerState.contractOwner);
        const isContractOwner = contractOwner == hiddenOwnerHex;

        return {
          offers: offers,
          accounts: accounts,
          myAssetHoldings: myAssetHoldings,
          opsFee: ledgerState.opsFee,
          treasuryBalance: ledgerState.treasury.value,
          accountsTotalBalance: ledgerState.accountsTotalBalance,
          isContractOwner: isContractOwner,
          balance: myBalance,
          offersPublished: myOffersCount,
        };
      },
    );
  }

  /**
   * Gets the address of the current deployed contract.
   */
  readonly deployedContractAddress: ContractAddress;

  /**
   * Gets an observable stream of state changes based on the current public (ledger),
   * and private state data.
   */
  readonly state$: Observable<AtaulfoDerivedState>;

  /**
   * Attempts to post a given message to the Ataulfo.
   *
   * @param message The message to post.
   *
   * @remarks
   * This method can fail during local circuit execution if the Ataulfo is currently occupied.
   */
  async createOffer(assetId: bigint, holdingId: string, shares: bigint, min: bigint, price: bigint, meta: string): Promise<string> {
    this.logger?.info(`creating offer for asset Id ${assetId} at a price of ${price}, with metadata: ${meta}`);

    const txData = await this.deployedContract.callTx.createOffer(assetId, fromHex(holdingId.trim()), shares, min, price, meta);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'createOffer',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });

    return toHex(txData.private.result);
  }

  async cancelOffer(offerId: string): Promise<Offer> {
    this.logger?.info(`cancelling offer for asset Id ${offerId}`);
    const idBytes = fromHex(offerId.trim());
    const txData = await this.deployedContract.callTx.cancelOffer(idBytes);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'cancelOffer',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });

    return txData.private.result;
  }

  async mint(assetId: bigint, shares: bigint): Promise<string> {
    this.logger?.info(`minting new token with Id ${assetId}`);

    const txData = await this.deployedContract.callTx.mint(assetId, shares);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'mint',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });

    return toHex(txData.private.result);
  }

  async withdrawCollectedFees(): Promise<bigint> {
    this.logger?.info(`withdrawing collected fees`);

    const txData = await this.deployedContract.callTx.withdrawCollectedFees();

    this.logger?.trace({
      transactionAdded: {
        circuit: 'withdrawCollectedFees',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });

    return txData.private.result;
  }

  async depositFunds(amount: bigint): Promise<[bigint, bigint]> {
    this.logger?.info(`depositing funds, amount: ${amount}`);

    let coinInfo = createCoinInfo(nativeToken(), amount);
    const txData = await this.deployedContract.callTx.depositFunds(encodeCoinInfo(coinInfo));

    this.logger?.trace({
      transactionAdded: {
        circuit: 'mint',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });

    return txData.private.result;
  }

  async withdrawFunds(amount: bigint): Promise<bigint> {
    this.logger?.info(`withdrawing funds: ${amount}`);
    const txData = await this.deployedContract.callTx.withdrawFunds(amount);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'withdrawFunds',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });

    return txData.private.result;
  }

  async balance(): Promise<bigint> {
    this.logger?.info(`querying balance`);
    const txData = await this.deployedContract.callTx.balance();

    this.logger?.trace({
      transactionAdded: {
        circuit: 'balance',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });

    return txData.private.result;
  }

  async fulfillOffer(offerId: string, shares: bigint): Promise<Offer> {
    this.logger?.info(`fulfilling offer with Id ${offerId}`);
    const idBytes = fromHex(offerId.trim());
    const txData = await this.deployedContract.callTx.fulfillOffer(idBytes, shares);

    this.logger?.trace({
      transactionAdded: {
        circuit: 'fulfillOffer',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });

    return txData.private.result;
  }

  /**
   * Deploys a new Ataulfo contract to the network.
   *
   * @param providers The Ataulfo providers.
   * @param logger An optional 'pino' logger to use for logging.
   * @returns A `Promise` that resolves with a {@link AtaulfoAPI} instance that manages the newly deployed
   * {@link DeployedAtaulfoContract}; or rejects with a deployment error.
   */
  static async deploy(providers: AtaulfoProviders, uri: string, localSecretKey: Uint8Array, operationsFee: bigint, logger?: Logger): Promise<AtaulfoAPI> {
    logger?.info('deployContract');

    const deployedAtaulfoContract = await deployContract<typeof ataulfoContractInstance>(providers, {
      privateStateId: ataulfoPrivateStateKey,
      contract: ataulfoContractInstance,
      initialPrivateState: await AtaulfoAPI.getPrivateState(providers, localSecretKey),
      args: [uri, operationsFee]
    });

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployedAtaulfoContract.deployTxData.public,
      },
    });

    return new AtaulfoAPI(deployedAtaulfoContract, providers, logger);
  }

  /**
   * Finds an already deployed Ataulfo contract on the network, and joins it.
   *
   * @param providers The Ataulfo providers.
   * @param contractAddress The contract address of the deployed Ataulfo contract to search for and join.
   * @param logger An optional 'pino' logger to use for logging.
   * @returns A `Promise` that resolves with a {@link AtaulfoAPI} instance that manages the joined
   * {@link DeployedAtaulfoContract}; or rejects with an error.
   */
  static async join(providers: AtaulfoProviders, contractAddress: ContractAddress, localSecretKey: Uint8Array, logger?: Logger): Promise<AtaulfoAPI> {
    logger?.info({
      joinContract: {
        contractAddress,
      },
    });

    const deployedAtaulfoContract = await findDeployedContract<AtaulfoContract>(providers, {
      contractAddress,
      contract: ataulfoContractInstance,
      privateStateId: ataulfoPrivateStateKey,
      initialPrivateState: await AtaulfoAPI.getPrivateState(providers, localSecretKey),
    });

    logger?.trace({
      contractJoined: {
        finalizedDeployTxData: deployedAtaulfoContract.deployTxData.public,
      },
    });

    return new AtaulfoAPI(deployedAtaulfoContract, providers, logger);
  }

  private static async getPrivateState(providers: AtaulfoProviders, localSecretKey: Uint8Array): Promise<AtaulfoPrivateState> {
    return createAtaulfoPrivateState(localSecretKey);
  }
}

export * from './common-types.js';
