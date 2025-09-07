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

import React, { useCallback, useEffect, useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import {
  Backdrop,
  CircularProgress,
  Card,
  CardActions,
  CardContent,
  IconButton,
  Typography,
  Grid,
  styled,
  Paper,
  Stack,
  Avatar,
  CardMedia,
  Button,
  Box,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import CopyIcon from '@mui/icons-material/ContentPasteOutlined';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ShareIcon from '@mui/icons-material/Share';
import SavingsIcon from '@mui/icons-material/Savings';
import HardwareIcon from '@mui/icons-material/Hardware';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { type AtaulfoDerivedState, type DeployedAtaulfoAPI } from '../../../api/src/index';
import { useDeployedAtaulfoContext } from '../hooks';
import { type AtaulfoDeployment } from '../contexts';
import { type Observable } from 'rxjs';
import { EmptyCardContent } from './Ataulfo.EmptyCardContent';
import { AlertDialog, ButtonAndDialog } from './TextPromptDialog';
import { LocalOffer } from '@mui/icons-material';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: '#007B7F',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: (theme.vars ?? theme).palette.text.secondary,
  ...theme.applyStyles('dark', {
    backgroundColor: '#007B7F',
  }),
}));

/** The props required by the {@link Ataulfo} component. */
export interface AtaulfoProps {
  /** The observable Ataulfo deployment. */
  ataulfoDeployment$?: Observable<AtaulfoDeployment>;
}

/**
 * Dashboard metrics to display in the Ataulfo admin panel
 * when the user is the owner of the contract.
 * Each entry is a tuple: [label, value].
 * @param ataulfoState The current AtaulfoDerivedState.
 */
const dashboardMetricsOwner = (ataulfoState: AtaulfoDerivedState) => [
  ['Operation fee', ataulfoState.opsFee],
  ['Earned collected fees', ataulfoState.treasuryBalance - ataulfoState.accountsTotalBalance],
  ['Active Offers', ataulfoState.offers.size],
  ['Users Accounts', ataulfoState.accounts.size],
  ['Treasury Balance', ataulfoState.treasuryBalance],
  ['Total Deposits Balance', ataulfoState.accountsTotalBalance]
];

/**
 * Dashboard metrics to display in the Ataulfo account status panel
 * when the user is not the owner of the contract.
 * Each entry is a tuple: [label, value].
 * @param ataulfoState The current AtaulfoDerivedState.
 */
const dashboardMetricsUsers = (ataulfoState: AtaulfoDerivedState) => [
  ['Offers published by you', ataulfoState.offersPublished],
  ['Account balance', ataulfoState.balance],
];

/**
 * Provides the UI for a deployed Ataulfo contract.
 */
export const Ataulfo: React.FC<Readonly<AtaulfoProps>> = ({ ataulfoDeployment$ }) => {
  const ataulfoApiProvider = useDeployedAtaulfoContext();
  const [ataulfoDeployment, setAtaulfoDeployment] = useState<AtaulfoDeployment>();
  const [deployedAtaulfoAPI, setDeployedAtaulfoAPI] = useState<DeployedAtaulfoAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [ataulfoState, setAtaulfoState] = useState<AtaulfoDerivedState>();
  const [isWorking, setIsWorking] = useState(false);

  const onCreateAtaulfo = useCallback((assetName: string, assetSymbol: string, opsFee: bigint, accountPassword: Uint8Array) => ataulfoApiProvider.create(assetName, assetSymbol, opsFee, accountPassword), [ataulfoApiProvider]);
  const onJoinAtaulfo = useCallback(
    (contractAddress: ContractAddress, accountPassword: Uint8Array) => ataulfoApiProvider.resolve(contractAddress, accountPassword),
    [ataulfoApiProvider],
  );

  // Callbacks to handle the interactions with the Ataulfo circuits using the methods of 
  // the `DeployedAtaulfoAPI` instance that we received in the `deployedAtaulfoAPI` state.
  const onMintAsset = useCallback(async (assetId: string) => {
    try {
      if (deployedAtaulfoAPI) {
        setIsWorking(true);
        await deployedAtaulfoAPI.mint(BigInt(assetId.trim()));
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedAtaulfoAPI, setErrorMessage, setIsWorking]);

  const onWithdrawCollectedFees = useCallback(async () => {
    try {
      if (deployedAtaulfoAPI) {
        setIsWorking(true);
        await deployedAtaulfoAPI.withdrawCollectedFees();
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedAtaulfoAPI, setErrorMessage, setIsWorking]);

  const onDepositFunds = useCallback(async (amount: string) => {
    try {
      if (deployedAtaulfoAPI) {
        setIsWorking(true);
        await deployedAtaulfoAPI.depositFunds(BigInt(amount.trim()));
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedAtaulfoAPI, setErrorMessage, setIsWorking]);

  const onWithdrawFunds = useCallback(async (amount: string) => {
    try {
      if (deployedAtaulfoAPI) {
        setIsWorking(true);
        await deployedAtaulfoAPI.withdrawFunds(BigInt(amount.trim()));
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedAtaulfoAPI, setErrorMessage, setIsWorking]);

  const onFulfillOffer = useCallback(async (offerId: string) => {
    try {
      if (deployedAtaulfoAPI) {
        setIsWorking(true);
        await deployedAtaulfoAPI.fulfillOffer(offerId);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedAtaulfoAPI, setErrorMessage, setIsWorking]);

  const onCreateOffer = useCallback(async (assetId: string, price: string, meta: string) => {
    try {
      if (deployedAtaulfoAPI) {
        setIsWorking(true);
        await deployedAtaulfoAPI.createOffer(BigInt(assetId.trim()), BigInt(price.trim()), meta.trim());
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedAtaulfoAPI, setErrorMessage, setIsWorking]);

  const onCancelOffer = useCallback(async (offerId: string) => {
    try {
      if (deployedAtaulfoAPI) {
        setIsWorking(true);
        await deployedAtaulfoAPI.cancelOffer(offerId);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedAtaulfoAPI, setErrorMessage, setIsWorking]);

  const onCopyContractAddress = useCallback(async () => {
    if (deployedAtaulfoAPI) {
      await navigator.clipboard.writeText(deployedAtaulfoAPI.deployedContractAddress);
    }
  }, [deployedAtaulfoAPI]);

  const onCopyOfferId = useCallback(async (offerId: string) => {
    await navigator.clipboard.writeText(offerId);
  }, []);

  // Subscribes to the `ataulfoDeployment$` observable so that we can receive updates on the deployment.
  useEffect(() => {
    if (!ataulfoDeployment$) {
      return;
    }

    const subscription = ataulfoDeployment$.subscribe(setAtaulfoDeployment);

    return () => {
      subscription.unsubscribe();
    };
  }, [ataulfoDeployment$]);

  // Subscribes to the `state$` observable on a `DeployedAtaulfoAPI` if we receive one, allowing the
  // component to receive updates to the change in contract state; otherwise we update the UI to
  // reflect the error was received instead.
  useEffect(() => {
    if (!ataulfoDeployment) {
      return;
    }
    if (ataulfoDeployment.status === 'init') {
      return;
    }
    if (ataulfoDeployment.status === 'in-progress') {
      setIsWorking(true);
      return;
    }

    setIsWorking(false);

    if (ataulfoDeployment.status === 'failed') {
      setErrorMessage(
        ataulfoDeployment.error.message.length ? ataulfoDeployment.error.message : 'Encountered an unexpected error.',
      );
      return;
    }

    // We need the Ataulfo API as well as subscribing to its `state$` observable, so that we can invoke
    // the methods later.
    setDeployedAtaulfoAPI(ataulfoDeployment.api);
    const subscription = ataulfoDeployment.api.state$.subscribe(setAtaulfoState);
    return () => {
      subscription.unsubscribe();
    };
  }, [ataulfoDeployment, setIsWorking, setErrorMessage, setDeployedAtaulfoAPI]);

  return (
    <Box sx={{ width: '100' }}>
      <Stack spacing={2}>
        <Backdrop
          sx={{ position: 'absolute', color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={isWorking}
        >
          <CircularProgress color="secondary" data-testid="ataulfo-working-indicator" />
        </Backdrop>

        <AlertDialog
          isOpen={!!errorMessage}
          title="Operation failed"
          msg={errorMessage ?? ''}
          onClose={() => {
            if (ataulfoDeployment?.status === 'failed') {
              ataulfoApiProvider.reset();
            }
            setErrorMessage(undefined);
          }}
        />

        {deployedAtaulfoAPI?.deployedContractAddress && (
          <Item>
            <Stack spacing={2} alignItems="center">
              <Box>
                <Avatar
                  alt="Ataulfo"
                  src="/avatarhd.png"
                  sx={{ width: 90, height: 90 }}
                />
              </Box>
              <Typography>
                {toShortFormatContractAddress(deployedAtaulfoAPI?.deployedContractAddress) ?? 'Loading...'}
                <IconButton title="Copy contract address" onClick={onCopyContractAddress}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Typography>
            </Stack>
          </Item>
        )}

        {(ataulfoState && ataulfoState.isContractOwner) && (
          <Item>
            <Stack spacing={2}>
              <Item>
                <Typography variant="button">Marketplace Admin Panel</Typography>
              </Item>
              <Item>
                <Grid container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }}>
                  {dashboardMetricsOwner(ataulfoState).map(([title, value], index) => (
                    <Grid key={index} size={{ xs: 2, sm: 4, md: 4 }}>
                      <Box>
                        <Typography variant="body1" gutterBottom>{`${title}: ${value}`}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Item>
              <React.Fragment>
                <Stack justifyContent="center"
                  direction="row"
                  divider={<Divider orientation="vertical" flexItem />}
                  spacing={2}
                ><Box>
                    <ButtonAndDialog
                      prompts={[['Enter ID for new asset (please remember it)']]}
                      btnCaption="Mint New Asset"
                      tooltip=''
                      btnIcon={<HardwareIcon />}
                      onSubmit={(texts) => onMintAsset(texts[0])}
                    />
                  </Box><Box>
                    <Button variant="contained" startIcon={<AttachMoneyIcon />}
                      data-testid="ataulfo-withdraw-collected-fees-btn"
                      disabled={ataulfoState.treasuryBalance <= ataulfoState.accountsTotalBalance}
                      onClick={onWithdrawCollectedFees}
                    >
                      Withdraw collected fees
                    </Button>
                  </Box>
                </Stack>
              </React.Fragment>
            </Stack>
          </Item>
        )}

        {ataulfoState && (
          <Item>
            <Stack spacing={2}>
              <Item>
                <Typography variant="button">Your Account</Typography>
              </Item>
              <Item>
                {ataulfoState &&
                  <Grid container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }}>
                    {dashboardMetricsUsers(ataulfoState).map(([title, value], index) => (
                      <Grid key={index} size={{ xs: 2, sm: 4, md: 4 }}>
                        <Box>
                          <Typography variant="body1" gutterBottom>{`${title}: ${value}`}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                }
              </Item>
              <Stack justifyContent="center"
                direction="row"
                divider={<Divider orientation="vertical" flexItem />}
                spacing={2}
              ><Box>
                  <ButtonAndDialog
                    prompts={[['Enter amount to deposit']]}
                    btnCaption="Deposit funds"
                    tooltip=''
                    btnIcon={<SavingsIcon />}
                    onSubmit={(texts) => onDepositFunds(texts[0])}
                  />
                </Box><Box>
                  <ButtonAndDialog
                    prompts={[['Enter amount to withdraw']]}
                    btnCaption="Withdraw funds"
                    tooltip=''
                    btnIcon={<AttachMoneyIcon />}
                    disabled={ataulfoState.balance == 0n}
                    onSubmit={(texts) => onWithdrawFunds(texts[0])}
                  />
                </Box><Box>
                  <ButtonAndDialog
                    prompts={[['Enter ID of the asset'],
                    ['Enter offered price'],
                    ['Enter the location of the asset'],
                    ['Enter a description of the offered asset'],
                    ['Enter image URL to display for the offer']]}
                    btnCaption="Create a new offer"
                    tooltip=''
                    btnIcon={<LocalOffer />}
                    onSubmit={(texts) => {
                      const assetId = texts[0];
                      const price = texts[1];
                      const meta = JSON.stringify({ location: texts[2], desc: texts[3], imageUrl: texts[4] });
                      onCreateOffer(assetId, price, meta);
                    }}
                  />
                </Box>
              </Stack>
            </Stack>
          </Item>
        )}

        {ataulfoState && (
          <Item>
            <Stack>
              <Item>
                <Typography variant="button">{`Active Offers (${ataulfoState.offers.size})`}</Typography>
              </Item>
              <Item>
                {ataulfoState && ataulfoState.offers ? (
                  <Grid container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }}>
                    {Array.from(ataulfoState.offers)
                      .map(([offerId, [offer, isMine]]) => {
                        const meta = deserializeMetadataJson(offer.meta);
                        return ({ id: offerId, isMine: isMine, assetId: offer.assetId, price: offer.price, location: meta.location, imageUrl: meta.imageUrl, desc: meta.desc });
                      })
                      .map((offer, index) => (
                        <Grid key={index} size={{ xs: 2, sm: 4, md: 4 }}>
                          <Card sx={{ maxWidth: 450, bgcolor: '#A4B0C4' }}>
                            <CardMedia
                              component="img"
                              height="180"
                              image={offer.imageUrl}
                              alt={offer.imageUrl}
                            />
                            <CardContent>
                              <Stack direction="row" justifyContent="space-between">
                                <Typography gutterBottom variant="body1" component="div">
                                  {offer.location}
                                </Typography>
                                <Typography gutterBottom variant="body1" component="div">
                                  {`${offer.price} tDUST`}
                                </Typography>
                              </Stack>
                              <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>
                                {offer.desc}
                              </Typography>
                            </CardContent>
                            <CardContent>
                              <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                {`Asset ID: ${offer.assetId}`}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {`Offer ID: ${offer.id.slice(0, 4)}...${offer.id.slice(-4)}`}
                              </Typography>
                            </CardContent>
                            <CardActions disableSpacing>
                              {offer.isMine ? (
                                <IconButton
                                  title="Cancel offer"
                                  data-testid="ataulfo-cancel-offer-btn"
                                  onClick={() => onCancelOffer(offer.id)}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              ) : (
                                <IconButton
                                  title="Buy asset"
                                  aria-label="buy"
                                  disabled={ataulfoState.balance == 0n}
                                  onClick={() => onFulfillOffer(offer.id)}
                                >
                                  <ShoppingCartIcon />
                                </IconButton>
                              )}
                              <IconButton
                                title="Share/copy offer Id"
                                aria-label="share"
                                onClick={() => onCopyOfferId(offer.id)}
                              >
                                <ShareIcon />
                              </IconButton>
                            </CardActions>
                          </Card>
                        </Grid>
                      ))}
                  </Grid>
                ) : (
                  <Typography>No offers available</Typography>
                )}
              </Item>
            </Stack>
          </Item>
        )}

        {ataulfoDeployment?.status === 'init' && (
          <Item>
            <Card sx={{ position: 'relative', width: 275, height: 300, minWidth: 275, minHeight: 300 }} color="primary">
              <EmptyCardContent onCreateAtaulfoCallback={onCreateAtaulfo} onJoinAtaulfoCallback={onJoinAtaulfo} />
            </Card>
          </Item >
        )}
      </Stack >
    </Box>
  );
};

/** @internal */
const toShortFormatContractAddress = (contractAddress: ContractAddress | undefined): React.ReactElement | undefined =>
  // Returns a new string made up of the first, and last, 8 characters of a given contract address.
  contractAddress ? (
    <span data-testid="ataulfo-address">
      Connected to contract: 0x{contractAddress?.replace(/^[A-Fa-f0-9]{6}([A-Fa-f0-9]{8}).*([A-Fa-f0-9]{8})$/g, '$1...$2')}
    </span>
  ) : undefined;

const deserializeMetadataJson = (string: string): { location: string, imageUrl: string, desc: string } => {
  try {
    // Attempt to parse the JSON string
    const parsedData = JSON.parse(string);
    const url = (new URL(parsedData.imageUrl).href ? parsedData.imageUrl : '');
    return { location: parsedData.location, imageUrl: url, desc: `${parsedData.desc.slice(0, 200)}...` };
  } catch (error) {
    const url = (new URL(string).href ? string : '');
    return { location: '', imageUrl: url, desc: '' }
  }
}