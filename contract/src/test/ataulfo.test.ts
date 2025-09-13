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

import { AtaulfoSimulator } from "./ataulfo-simulator.js";
import { toHex, fromHex } from '@midnight-ntwrk/midnight-js-utils';
import {
  NetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes, randomCoinPublicKeyHex } from "./utils.js";
import { encodeCoinPublicKey } from "@midnight-ntwrk/compact-runtime";
import { createCoinInfo, nativeToken } from "@midnight-ntwrk/ledger";

setNetworkId(NetworkId.Undeployed);

describe("Ataulfo smart contract", () => {
  it("properly initializes ledger state and private state", () => {
    const pwd = randomBytes(32);
    const pk = randomCoinPublicKeyHex();
    const simulator0 = new AtaulfoSimulator(pwd, pk);
    const ledger0 = simulator0.getLedger();
    expect(ledger0.treasury.value).toEqual(0n);
    expect(ledger0.opsFee).toEqual(1n);
    const hiddenContractOwner = simulator0.genHiddenOwner();
    expect(ledger0.contractOwner).toEqual(hiddenContractOwner);
    expect(ledger0.accounts.size()).toEqual(0n);
    expect(ledger0.accountsTotalBalance).toEqual(0n);
    expect(ledger0.offers.size()).toEqual(0n);
    const initialPrivateState = simulator0.getPrivateState();
    expect(initialPrivateState).toEqual({ secretKey: pwd });

    const simulator1 = new AtaulfoSimulator(pwd, pk);
    const ledger1 = simulator1.getLedger();
    expect(ledger0.contractOwner).toEqual(ledger1.contractOwner);
    expect(ledger0.treasury).toEqual(ledger1.treasury);
    expect(ledger0.offers.size()).toEqual(ledger1.offers.size());
    expect(ledger0.accounts.size()).toEqual(ledger1.accounts.size());
    expect(ledger0.accountsTotalBalance).toEqual(ledger1.accountsTotalBalance);
  });

  it("contract owner can only mint", () => {
    const pk = randomCoinPublicKeyHex();
    const simulator = new AtaulfoSimulator(randomBytes(32), pk);

    const assetId = 100n;
    simulator.mint(assetId);
    expect(() => simulator.mint(assetId))
      .toThrow("failed assert: NonFungibleToken: Invalid Sender"); // TODO: improve error message...?
    expect(simulator.isOwnerOf(assetId)).toBe(true);
    expect(() =>
      simulator.isOwnerOf(10n),
    ).toThrow("failed assert: Invalid asset ID");

    const pk2 = randomCoinPublicKeyHex();
    simulator.switchUser(randomBytes(32), pk2);
    expect(() => simulator.mint(2n))
      .toThrow("failed assert: Only the contract owner can mint new assets");
    expect(simulator.isOwnerOf(assetId)).toBe(false);
  });

  it("publishing an offer by asset owner", () => {
    const pk = randomCoinPublicKeyHex();
    const pwd = randomBytes(32);
    const simulator = new AtaulfoSimulator(pwd, pk);

    const assetId = 200n;
    const price = 12345n;
    const meta = toHex(randomBytes(10));

    simulator.mint(assetId);
    expect(() => simulator.createOffer(assetId, 0n, meta))
      .toThrow("failed assert: Price must be greater than zero");
    expect(simulator.getLedger().offers.isEmpty()).toBe(true);
    const offerId = simulator.createOffer(assetId, price, meta);
    expect(offerId).toEqual(simulator.genOfferId(simulator.getPrivateState().secretKey, assetId, price));

    const offer = simulator.getLedger().offers.lookup(offerId);
    expect(offer.assetId).toEqual(assetId);
    expect(offer.assetOwner.left.bytes).toEqual(Uint8Array.from(fromHex(pk)));
    expect(offer.price).toEqual(price);
    expect(offer.meta).toEqual(meta);
  });

  it("publish an offer allowed only to owner or approved", () => {
    const pk = randomCoinPublicKeyHex();
    const pwd = randomBytes(32);
    const simulator = new AtaulfoSimulator(pwd, pk);

    const assetId = 200n;
    const price = 12345n;
    const meta = toHex(randomBytes(10));
    simulator.mint(assetId);

    // another party cannot create an offer
    const pk2 = randomCoinPublicKeyHex();
    const pwd2 = randomBytes(32);
    simulator.switchUser(pwd2, pk2);
    expect(() => simulator.createOffer(assetId, price, meta))
      .toThrow("failed assert: Offer publisher must be the owner or operator of the asset");
    expect(simulator.getLedger().offers.isEmpty()).toBe(true);

    // but if the owner approves another party as an operator, it should then be able to create an offer.
    // TODO: createOffer doesn't allow yet approved on a single asset, only owner and operators for now.
    // In the future we shall also test a party which was approved only for this asset to create offers.
    simulator.switchUser(pwd, pk);
    simulator.setApprovalForAll(encodeCoinPublicKey(pk2), true);
    simulator.switchUser(pwd2, pk2);
    const offerId = simulator.createOffer(assetId, price, meta);
    const ledgerState = simulator.getLedger();
    expect(ledgerState.offers.size()).toEqual(1n);
    expect(ledgerState.offers.lookup(offerId).assetId).toEqual(assetId);
    expect(ledgerState.offers.lookup(offerId).price).toEqual(price);
    expect(ledgerState.offers.lookup(offerId).meta).toEqual(meta);
  });

  it("creating offers with same asset more than once", () => {
    const pk = randomCoinPublicKeyHex();
    const pwd = randomBytes(32);
    const simulator = new AtaulfoSimulator(pwd, pk);

    const assetId = 600n;
    const meta = toHex(randomBytes(10));
    simulator.mint(assetId);

    const offerId1 = simulator.createOffer(assetId, 1000n, meta);
    const offerId2 = simulator.createOffer(assetId, 2000n, meta);
    expect(offerId1 != offerId2).toBe(true);
    let ledgerState = simulator.getLedger();
    expect(ledgerState.offers.size()).toEqual(2n);
    expect(ledgerState.offers.lookup(offerId1).price).toEqual(1000n);
    expect(ledgerState.offers.lookup(offerId2).price).toEqual(2000n);
    expect(ledgerState.offers.lookup(offerId2).meta).toEqual(meta);

    // this will replace previous offer with offerId2 to have a new metadata
    const newMeta = `different-meta-${meta}`;
    const offerId3 = simulator.createOffer(assetId, 2000n, newMeta);
    expect(offerId1 != offerId3).toBe(true);
    expect(offerId2).toEqual(offerId3);
    ledgerState = simulator.getLedger();
    expect(ledgerState.offers.size()).toEqual(2n);
    expect(ledgerState.offers.lookup(offerId1).price).toEqual(1000n);
    expect(ledgerState.offers.lookup(offerId3).price).toEqual(2000n);
    expect(ledgerState.offers.lookup(offerId3).meta).toEqual(newMeta);

    const pk2 = randomCoinPublicKeyHex();
    const pwd2 = randomBytes(32);
    simulator.setApprovalForAll(encodeCoinPublicKey(pk2), true);
    simulator.switchUser(pwd2, pk2);
    const offerId4 = simulator.createOffer(assetId, 2000n, newMeta);
    expect(simulator.getLedger().offers.size()).toEqual(3n);
    expect(offerId3 != offerId4).toBe(true);
  });

  it("cancelling an offer by publisher", () => {
    const pk = randomCoinPublicKeyHex();
    const user = randomBytes(32);
    const simulator = new AtaulfoSimulator(user, pk);

    const assetId = 300n;
    const price = 54321n;
    const meta = toHex(randomBytes(10));
    simulator.mint(assetId);
    const offerId = simulator.createOffer(assetId, price, meta);
    expect(simulator.getLedger().offers.size()).toBe(1n);
    expect(() => simulator.cancelOffer(randomBytes(32)))
      .toThrow("failed assert: Offer does not exist");
    expect(simulator.getLedger().offers.size()).toBe(1n);
    const offer = simulator.cancelOffer(offerId);
    expect(offer.assetId).toEqual(assetId);
    expect(offer.price).toEqual(price);
    expect(offer.meta).toEqual(meta);
    expect(simulator.getLedger().offers.isEmpty()).toBe(true);
  });

  it("asset owner can always cancel an offer published by operator", () => {
    const pk = randomCoinPublicKeyHex();
    const user = randomBytes(32);
    const simulator = new AtaulfoSimulator(user, pk);

    const assetId = 300n;
    const price = 54321n;
    const meta = toHex(randomBytes(10));
    simulator.mint(assetId);

    // another party set as operator can create an offer
    const pk2 = randomCoinPublicKeyHex();
    const pwd2 = randomBytes(32);
    simulator.setApprovalForAll(encodeCoinPublicKey(pk2), true);

    simulator.switchUser(pwd2, pk2);
    const offerId = simulator.createOffer(assetId, price, meta);
    expect(simulator.getLedger().offers.size()).toBe(1n);

    simulator.switchUser(user, pk);
    const offer = simulator.cancelOffer(offerId);
    expect(offer.assetId).toEqual(assetId);
    expect(offer.price).toEqual(price);
    expect(offer.meta).toEqual(meta);
    expect(simulator.getLedger().offers.isEmpty()).toBe(true);
  });

  it("deposit funds", () => {
    const pk = randomCoinPublicKeyHex();
    const user = randomBytes(32);
    const simulator = new AtaulfoSimulator(user, pk);
    const opsFee = simulator.getLedger().opsFee;
    const amount = 400n;

    let nonNativeCoinInfo = createCoinInfo(`0200${toHex(randomBytes(32))}`, amount);
    expect(() => simulator.depositFunds(nonNativeCoinInfo))
      .toThrow("failed assert: Only native tokens can be deposited");
    let tooLittleCoinInfo = createCoinInfo(nativeToken(), opsFee - 1n);
    expect(() => simulator.depositFunds(tooLittleCoinInfo))
      .toThrow("failed assert: Deposit amount must be greater than the operations fee");
    let ledgerState = simulator.getLedger();
    expect(ledgerState.treasury.value).toEqual(0n);
    expect(ledgerState.accounts.isEmpty()).toBe(true);
    expect(ledgerState.accountsTotalBalance).toEqual(0n);

    let coinInfo = createCoinInfo(nativeToken(), amount);
    const [deposited, balance] = simulator.depositFunds(coinInfo);
    expect(deposited).toEqual(amount - opsFee);
    expect(balance).toEqual(amount - opsFee);
    ledgerState = simulator.getLedger();
    expect(ledgerState.treasury.value).toEqual(amount);
    expect(ledgerState.accounts.size()).toEqual(1n);
    expect(ledgerState.accountsTotalBalance).toEqual(amount - opsFee);
    const balanceOwner = simulator.genHiddenOwner();
    expect(ledgerState.accounts.lookup(balanceOwner)).toEqual(amount - opsFee);
    expect(simulator.balance()).toEqual(amount - opsFee);

    const additionalAmount = 250n;
    const newBalance = amount + additionalAmount - (2n * opsFee);
    let additionalCoinInfo = createCoinInfo(nativeToken(), additionalAmount);
    const [newDeposited, updatedBalance] = simulator.depositFunds(additionalCoinInfo);
    expect(newDeposited).toEqual(additionalAmount - opsFee);
    expect(updatedBalance).toEqual(newBalance);
    ledgerState = simulator.getLedger();
    expect(ledgerState.treasury.value).toBe(amount + additionalAmount);
    expect(ledgerState.accounts.size()).toEqual(1n);
    expect(ledgerState.accountsTotalBalance).toEqual(newBalance);
    expect(ledgerState.accounts.lookup(balanceOwner)).toEqual(newBalance);
    expect(simulator.balance()).toEqual(newBalance);
  });

  it("withdraw funds", () => {
    const pk = randomCoinPublicKeyHex();
    const user = randomBytes(32);
    const simulator = new AtaulfoSimulator(user, pk);
    const opsFee = simulator.getLedger().opsFee;
    const amount = 4000n;

    expect(() => simulator.withdrawFunds(amount))
      .toThrow("failed assert: No balance deposited to withdraw");

    let coinInfo = createCoinInfo(nativeToken(), amount);
    const [deposited, balance] = simulator.depositFunds(coinInfo);
    expect(deposited).toEqual(amount - opsFee);
    expect(balance).toEqual(amount - opsFee);
    let ledgerState = simulator.getLedger();
    expect(ledgerState.treasury.value).toEqual(amount);
    expect(ledgerState.accounts.size()).toEqual(1n);
    expect(ledgerState.accountsTotalBalance).toEqual(amount - opsFee);
    const balanceOwner = simulator.genHiddenOwner();
    expect(ledgerState.accounts.lookup(balanceOwner)).toEqual(amount - opsFee);
    expect(simulator.balance()).toEqual(amount - opsFee);

    const withdrawalAmount = 250n;
    const newBalance = amount - withdrawalAmount - (2n * opsFee);
    const updatedBalance = simulator.withdrawFunds(withdrawalAmount);
    expect(updatedBalance).toEqual(newBalance);
    ledgerState = simulator.getLedger();
    expect(ledgerState.treasury.value).toEqual(amount - withdrawalAmount);
    expect(ledgerState.accounts.size()).toEqual(1n);
    expect(ledgerState.accountsTotalBalance).toEqual(newBalance);
    expect(ledgerState.accounts.lookup(balanceOwner)).toEqual(newBalance);
    expect(simulator.balance()).toEqual(newBalance);

    expect(() => simulator.withdrawFunds(opsFee))
      .toThrow("failed assert: Withdraw amount must be greater than the operations fee");
    expect(() => simulator.withdrawFunds(newBalance))
      .toThrow("failed assert: Insufficient balance to withdraw the requested amount and pay the operation fee");
    ledgerState = simulator.getLedger();
    expect(ledgerState.treasury.value).toEqual(amount - withdrawalAmount);
    expect(ledgerState.accounts.size()).toEqual(1n);
    expect(ledgerState.accountsTotalBalance).toEqual(newBalance);
    expect(ledgerState.accounts.lookup(balanceOwner)).toEqual(newBalance);
    expect(simulator.balance()).toEqual(newBalance);
  });

  it("fulfill an offer", () => {
    const pk = randomCoinPublicKeyHex();
    const pwd = randomBytes(32);
    const simulator = new AtaulfoSimulator(pwd, pk);
    const opsFee = simulator.getLedger().opsFee;

    const assetId = 1200n;
    const price = 100n;
    const meta = toHex(randomBytes(10));
    simulator.mint(assetId);

    const offerId = simulator.createOffer(assetId, price, meta);
    expect(simulator.getLedger().offers.member(offerId)).toBe(true);
    expect(() => simulator.fulfillOffer(offerId))
      .toThrow("failed assert: Offer cannot be fulfilled by the publisher");

    const pk2 = randomCoinPublicKeyHex();
    const pwd2 = randomBytes(32);
    simulator.switchUser(pwd2, pk2);
    expect(() => simulator.fulfillOffer(offerId))
      .toThrow("failed assert: No balance deposited to fulfill the offer and operation fee");

    // we'll need a balance of: price + 2*opsFee to fulfill it, since we pay for depositing and for fulfilling it
    const initialAmount = price + opsFee;
    let coinInfo = createCoinInfo(nativeToken(), initialAmount);
    simulator.depositFunds(coinInfo);
    expect(simulator.balance()).toBe(initialAmount - opsFee);
    expect(simulator.getLedger().treasury.value).toBe(initialAmount);
    expect(() => simulator.fulfillOffer(offerId))
      .toThrow("failed assert: Insufficient balance to fulfill the offer and operation fee");
    const invalidOfferId = randomBytes(32);
    expect(() => simulator.fulfillOffer(invalidOfferId))
      .toThrow("failed assert: Offer does not exist");

    const topUpAmount = 2n * opsFee;
    coinInfo = createCoinInfo(nativeToken(), topUpAmount);
    simulator.depositFunds(coinInfo);
    expect(simulator.balance()).toBe(initialAmount + topUpAmount - 2n * opsFee);
    expect(simulator.getLedger().treasury.value).toEqual(initialAmount + topUpAmount);

    const offer = simulator.fulfillOffer(offerId);
    const ledgerState = simulator.getLedger();
    expect(ledgerState.offers.isEmpty()).toBe(true);
    expect(ledgerState.offers.member(offerId)).toBe(false);
    expect(offer.assetId).toEqual(assetId);
    expect(offer.price).toEqual(price);
    expect(offer.meta).toEqual(meta);
    expect(simulator.balance()).toBe(initialAmount + topUpAmount - price - 3n * opsFee);
    expect(simulator.getLedger().treasury.value).toEqual(initialAmount + topUpAmount - price);

    expect(() => simulator.fulfillOffer(offerId))
      .toThrow("failed assert: Offer does not exist");
  });

  it("withdraw collected fees", () => {
    const pk = randomCoinPublicKeyHex();
    const user = randomBytes(32);
    const simulator = new AtaulfoSimulator(user, pk);
    const opsFee = simulator.getLedger().opsFee;
    const amount = 2500n;

    expect(() => simulator.withdrawCollectedFees())
      .toThrow("failed assert: No collected fees available for withdrawal");

    let coinInfo = createCoinInfo(nativeToken(), amount);
    simulator.depositFunds(coinInfo);
    const balanceOwner = simulator.genHiddenOwner();

    const expectedCollectedFees = 2n * opsFee;
    const withdrawalAmount = amount - expectedCollectedFees;
    const updatedBalance = simulator.withdrawFunds(withdrawalAmount);
    expect(updatedBalance).toEqual(0n);
    let ledgerState = simulator.getLedger();
    expect(ledgerState.treasury.value).toEqual(amount - withdrawalAmount);
    expect(ledgerState.accounts.size()).toEqual(0n);
    expect(ledgerState.accountsTotalBalance).toEqual(0n);
    expect(simulator.balance()).toEqual(0n);

    expect(simulator.withdrawCollectedFees()).toBe(expectedCollectedFees);
    ledgerState = simulator.getLedger();
    expect(ledgerState.treasury.value).toEqual(0n);
    expect(ledgerState.accounts.size()).toEqual(0n);
    expect(ledgerState.accountsTotalBalance).toEqual(0n);
    expect(simulator.balance()).toEqual(0n);

    const lastAmount = 10n;
    coinInfo = createCoinInfo(nativeToken(), lastAmount);
    simulator.depositFunds(coinInfo);
    ledgerState = simulator.getLedger();
    expect(ledgerState.treasury.value).toEqual(lastAmount);
    expect(simulator.balance()).toEqual(lastAmount - opsFee);

    const pk2 = randomCoinPublicKeyHex();
    const pwd2 = randomBytes(32);
    simulator.switchUser(pwd2, pk2);
    expect(() => simulator.withdrawCollectedFees())
      .toThrow("failed assert: Only the contract owner can withdraw collected fees");
  });
});
