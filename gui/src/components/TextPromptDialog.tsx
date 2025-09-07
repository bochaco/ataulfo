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

import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grid, Stack, TextField, Tooltip, Typography } from '@mui/material';
import StopIcon from '@mui/icons-material/HighlightOffOutlined';
import React, { useState } from 'react';

/**
 * The props required by the {@link TextPromptDialog} component.
 */
export interface AlertDialogProps {
  /** The title to show in the alert dialog. */
  title: string;
  /** The alert message content. */
  msg: string;
  /** Flag indicating if the dialog is open. */
  isOpen: boolean;
  /** A callback that will be called if the user closes the dialog. */
  onClose: () => void;
}

/**
 * A simple modal dialog that allerts the user with textual content.
 */
export const AlertDialog: React.FC<Readonly<AlertDialogProps>> = ({ title, msg, isOpen, onClose }) => {
  return (
    <Dialog
      fullWidth maxWidth="sm"
      open={isOpen}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        <Typography color="error" component="div" data-testid="ataulfo-error-message">
          {title}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          <Typography color="error" component="div" data-testid="ataulfo-error-message">
            {msg}
          </Typography>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export interface ButtonAndDialogProps {
  /** The prompts to display to the user each with a flag indicating if it's a password prompt. */
  prompts: Array<[string, boolean?]>;
  /** The caption for the button to display. */
  btnCaption: string;
  /** The icon for the button to display. */
  btnIcon: React.ReactNode;
  /** Tooltip on the button */
  tooltip?: string;
  /** Flag to mark the button as disabled */
  disabled?: boolean;
  /** A callback that will be called when the user submits their inputted data. */
  onSubmit: (texts: Array<string>) => void;
}

export const ButtonAndDialog: React.FC<Readonly<ButtonAndDialogProps>> = ({ prompts, btnCaption, btnIcon, tooltip, disabled, onSubmit }) => {
  const [isOpen, setIsOpen] = useState(false);
  let promptsAndStates = new Array();
  prompts.forEach(([prompt, isPassword]) => {
    //if (isPassword) {
    promptsAndStates.push([[prompt, isPassword !== undefined && isPassword ? 'password' : ''], useState<string>('')]);
    //} else {
    //  promptsAndStates.push([prompt, "", useState<string>('')]);
    //}
  });

  const onCancel = () => setIsOpen(false);

  return (
    <Box color="primary.dark">
      <Dialog open={isOpen} onClose={onCancel} fullWidth maxWidth="sm">
        <DialogTitle>
          <Typography variant="body1" color="black" data-testid="textprompt-dialog-title">
            {btnCaption}
          </Typography>
        </DialogTitle>

        {promptsAndStates.map(([[prompt, promptType], [t, setText]], index) => (
          <DialogContent >
            <Typography variant="body1" color="black" data-testid={`textprompt-dialog-prompt-${index}`}>
              {prompt}
            </Typography>
            <TextField
              id={`text-prompt-${index}`}
              type={promptType}
              variant="outlined"
              focused
              fullWidth
              size="small"
              color="primary"
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
              data-testid={`textprompt-dialog-text-prompt-${index}`}
            />
          </DialogContent>
        ))}

        <DialogActions>
          <Button variant="contained" data-testid="textprompt-dialog-cancel-btn" disableElevation onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="contained"
            data-testid="textprompt-dialog-ok-btn"
            disabled={promptsAndStates.find(([p, [t, s]]) => !t.length)}
            disableElevation
            onClick={() => {
              setIsOpen(false);
              const texts = promptsAndStates.map(([a, [t, s]]) => { return t; });
              onSubmit(texts);
            }}
            type="submit"
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Tooltip title={tooltip}>
        <Button variant="contained" startIcon={btnIcon}
          data-testid="ataulfo-op-btn"
          disabled={disabled}
          onClick={() => setIsOpen(true)}
        >
          {btnCaption}
        </Button>
      </Tooltip>
    </Box>
  );
};
