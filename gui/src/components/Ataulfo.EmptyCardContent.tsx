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

import React, { useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { Avatar, Box, Button, CardActions, CardContent, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import CreateBoardIcon from '@mui/icons-material/AddCircleOutlined';
import JoinBoardIcon from '@mui/icons-material/AddLinkOutlined';
import { ButtonAndDialog } from './TextPromptDialog';

/**
 * The props required by the {@link EmptyCardContent} component.
 *
 * @internal
 */
export interface EmptyCardContentProps {
  /** A callback that will be called to create a new Ataulfo. */
  onCreateAtaulfoCallback: (assetUri: string, opsFee: bigint, accountPassword: Uint8Array) => void;
  /** A callback that will be called to join an existing Ataulfo. */
  onJoinAtaulfoCallback: (contractAddress: ContractAddress, accountPassword: Uint8Array) => void;
}

/**
 * Used when there is no Ataulfo deployment to render a UI allowing the user to join or deploy Ataulfos.
 *
 * @internal
 */
export const EmptyCardContent: React.FC<Readonly<EmptyCardContentProps>> = ({
  onCreateAtaulfoCallback,
  onJoinAtaulfoCallback,
}) => {
  return (
    <React.Fragment>
      <CardContent>
        <Stack spacing={2} alignItems="center">
          <Box>
            <Avatar
              alt="Ataulfo"
              src="/avatarhd.png"
              sx={{ width: 120, height: 120 }}
            />
          </Box>
          <Typography data-testid="ataulfo-posted-message" align="center" variant="body1" color="primary.dark">
            Create a new RWA marketplace, or connect to an existing one...
          </Typography>
        </Stack>
      </CardContent>
      <CardActions sx={{ justifyContent: 'center' }}>
        <ButtonAndDialog
          prompts={[['Enter the URI for the assets NFT'],
          ['Enter the operations fee to charge by the contract'],
          ['Account password (please do not forget it)', true]]}
          btnCaption="Create"
          tooltip="Create a new marketplace"
          btnIcon={<CreateBoardIcon />}
          onSubmit={(texts) => {
            onCreateAtaulfoCallback(texts[0], BigInt(texts[1].trim()), Uint8Array.from(texts[2]));
          }}
        />
        <ButtonAndDialog
          prompts={[['Enter marketplace contract address'], ['Account password', true]]}
          btnCaption="Join"
          tooltip="Join an existing marketplace"
          btnIcon={<JoinBoardIcon />}
          onSubmit={(texts) => {
            onJoinAtaulfoCallback(texts[0], Uint8Array.from(texts[1]));
          }}
        />
      </CardActions>
    </React.Fragment>
  );
};
