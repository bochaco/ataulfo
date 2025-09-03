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
 * Ataulfo common types and abstractions.
 *
 * @module
 */

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { Offer, AtaulfoPrivateState, Contract, Witnesses } from '../../contract/src/index';

export const ataulfoPrivateStateKey = 'ataulfoPrivateState';
export type PrivateStateId = typeof ataulfoPrivateStateKey;

/**
 * The private states consumed throughout the application.
 *
 * @remarks
 * {@link PrivateStates} can be thought of as a type that describes a schema for all
 * private states for all contracts used in the application. Each key represents
 * the type of private state consumed by a particular type of contract.
 * The key is used by the deployed contract when interacting with a private state provider,
 * and the type (i.e., `typeof PrivateStates[K]`) represents the type of private state
 * expected to be returned.
 *
 * Since there is only one contract type for the bulletin board example, we only define a
 * single key/type in the schema.
 *
 * @public
 */
export type PrivateStates = {
  /**
   * Key used to provide the private state for {@link AtaulfoContract} deployments.
   */
  readonly ataulfoPrivateState: AtaulfoPrivateState;
};

/**
 * Represents a bulletin board contract and its private state.
 *
 * @public
 */
export type AtaulfoContract = Contract<AtaulfoPrivateState, Witnesses<AtaulfoPrivateState>>;

/**
 * The keys of the circuits exported from {@link AtaulfoContract}.
 *
 * @public
 */
export type AtaulfoCircuitKeys = Exclude<keyof AtaulfoContract['impureCircuits'], number | symbol>;

/**
 * The providers required by {@link AtaulfoContract}.
 *
 * @public
 */
export type AtaulfoProviders = MidnightProviders<AtaulfoCircuitKeys, PrivateStateId, AtaulfoPrivateState>;

/**
 * A {@link AtaulfoContract} that has been deployed to the network.
 *
 * @public
 */
export type DeployedAtaulfoContract = FoundContract<AtaulfoContract>;

/**
 * A type that represents the derived combination of public (or ledger), and private state.
 */
export type AtaulfoDerivedState = {
  readonly offers: Map<string, Offer>;
  readonly accounts: Map<string, bigint>;
};
