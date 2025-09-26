// This file is part of midnightntwrk/example-bboard.
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
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  constructorContext,
  emptyZswapLocalState,
  CoinInfo,
  encodeContractAddress,
  dummyContractAddress,
  assert,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
  Offer,
} from "../managed/ataulfo/contract/index.cjs";
import { type AtaulfoPrivateState, witnesses } from "../witnesses.js";
import { encodeCoinInfo } from "@midnight-ntwrk/ledger";

/**
 * Serves as a testbed to exercise the contract in tests
 */
export class AtaulfoSimulator {
  readonly contract: Contract<AtaulfoPrivateState>;
  circuitContext: CircuitContext<AtaulfoPrivateState>;

  constructor(secretKey: Uint8Array, senderPk: string) {
    this.contract = new Contract<AtaulfoPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      constructorContext({ secretKey }, senderPk), 'http://ataulfo.rwa', 1n
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      originalState: currentContractState,
      transactionContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  private buildEitherLeft(bytes: Uint8Array): any {
    return {
      is_left: true,
      left: { bytes: bytes },
      right: { bytes: encodeContractAddress(dummyContractAddress()) }
    };
  }

  /***
   * Switch to a different secret key for a different user
   */
  public switchUser(secretKey: Uint8Array, senderPk: string) {
    const diffPwdOrPk = this.circuitContext.currentPrivateState.secretKey !== secretKey;
    assert(diffPwdOrPk, "Cannot switch user with same Password");
    this.circuitContext.currentZswapLocalState = emptyZswapLocalState(senderPk);
    this.circuitContext.currentPrivateState = {
      secretKey
    };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.transactionContext.state);
  }

  public getPrivateState(): AtaulfoPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public mint(assetId: bigint, shares: bigint): Uint8Array {
    // Update the current context to be the result of executing the circuit.
    const res = this.contract.impureCircuits.mint(
      this.circuitContext, assetId, shares
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public assetBalance(assetId: bigint, holdingId: Uint8Array): bigint {
    const res = this.contract.circuits.assetBalance(
      this.circuitContext, assetId, holdingId
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public myAssetBalance(assetId: bigint): bigint {
    const res = this.contract.circuits.myAssetBalance(
      this.circuitContext, assetId
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public setApproval(assetId: bigint, holdingId: Uint8Array, target: Uint8Array, approved: boolean): Ledger {
    this.circuitContext = this.contract.impureCircuits.setApproval(
      this.circuitContext, assetId, holdingId, this.buildEitherLeft(target), approved
    ).context;
    return ledger(this.circuitContext.transactionContext.state);
  }

  public isApproved(assetId: bigint, holdingId: Uint8Array): boolean {
    const res = this.contract.impureCircuits.isApproved(
      this.circuitContext, assetId, holdingId
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public isApprovedOperator(operator: Uint8Array, assetId: bigint, holdingId: Uint8Array): boolean {
    const res = this.contract.impureCircuits.isApprovedOperator(
      this.circuitContext, this.buildEitherLeft(operator), assetId, holdingId
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public setApprovalForAll(operator: Uint8Array, approved: boolean): Ledger {
    //this.circuitContext = this.contract.circuits.setApprovalForAll(
    //  this.circuitContext, { bytes: operator }, approved
    //).context;
    return ledger(this.circuitContext.transactionContext.state);
  }

  public withdrawCollectedFees(): bigint {
    const res = this.contract.impureCircuits.withdrawCollectedFees(
      this.circuitContext
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public createOffer(assetId: bigint, holdingId: Uint8Array, shares: bigint, min: bigint, price: bigint, meta: string): Uint8Array {
    const res = this.contract.impureCircuits.createOffer(
      this.circuitContext, assetId, holdingId, shares, min, price, meta
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public cancelOffer(offerId: Uint8Array): Offer {
    const res = this.contract.impureCircuits.cancelOffer(
      this.circuitContext, offerId
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public depositFunds(coinInfo: CoinInfo): [bigint, bigint] {
    const res = this.contract.impureCircuits.depositFunds(
      this.circuitContext, encodeCoinInfo(coinInfo)
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public withdrawFunds(amount: bigint): bigint {
    const res = this.contract.impureCircuits.withdrawFunds(
      this.circuitContext, amount
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public balance(): bigint {
    const res = this.contract.impureCircuits.balance(
      this.circuitContext
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public treasuryBalance(): bigint {
    const res = this.contract.impureCircuits.treasuryBalance(
      this.circuitContext
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public fulfillOffer(offerId: Uint8Array, shares: bigint): Offer {
    const res = this.contract.impureCircuits.fulfillOffer(
      this.circuitContext, offerId, shares
    );
    this.circuitContext = res.context;
    return res.result;
  }

  public genOfferId(publisher: Uint8Array, holdingId: Uint8Array, price: bigint): Uint8Array {
    return this.contract.circuits.genOfferId(
      this.circuitContext, publisher, holdingId, price
    ).result;
  }

  public genHiddenOwner(pk: Uint8Array): Uint8Array {
    return this.contract.circuits.genHiddenOwner(
      this.circuitContext, this.buildEitherLeft(pk)
    ).result;
  }
}
