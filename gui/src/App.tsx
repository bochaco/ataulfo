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

import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { MainLayout, Ataulfo } from './components';
import { useDeployedAtaulfoContext } from './hooks';
import { type AtaulfoDeployment } from './contexts';
import { type Observable } from 'rxjs';

/**
 * The root Ataulfo application component.
 *
 * @remarks
 * The {@link App} component requires a `<DeployedAtaulfoProvider />` parent in order to retrieve
 * information about current Ataulfo deployments.
 *
 * @internal
 */
const App: React.FC = () => {
  const ataulfoApiProvider = useDeployedAtaulfoContext();
  const [ataulfoDeployment, setAtaulfoDeployment] = useState<Observable<AtaulfoDeployment>>();

  useEffect(() => {
    const subscription = ataulfoApiProvider.ataulfoDeployment$.subscribe(setAtaulfoDeployment);

    return () => {
      subscription.unsubscribe();
    };
  }, [ataulfoApiProvider]);

  return (
    <Box sx={{ background: '#000', minHeight: '100vh' }}>
      <MainLayout>
        <div data-testid="ataulfo-start">
          <Ataulfo ataulfoDeployment$={ataulfoDeployment} />
        </div>
      </MainLayout>
    </Box>
  );
};

export default App;
