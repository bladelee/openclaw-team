/**
 * A2UI Host Component
 * Root container for A2UI surfaces
 */

import React from 'react';
import { useA2uiMessages } from '../context';
import { useA2uiAction } from '../context/A2uiActionContext';
import { A2uiSurface } from './surfaces/A2uiSurface';
import { EmptySurface } from './surfaces/EmptySurface';
import { ToastContainer, Status } from './feedback';

export const A2uiHost: React.FC = () => {
  const { surfaces } = useA2uiMessages();
  const { toast } = useA2uiAction();

  if (surfaces.size === 0) {
    return (
      <>
        <EmptySurface />
        {toast && <ToastContainer toasts={[toast]} />}
        <Status />
      </>
    );
  }

  return (
    <div className="a2ui-root">
      {Array.from(surfaces.values()).map(surface => (
        <A2uiSurface key={surface.id} surface={surface} />
      ))}
      {toast && <ToastContainer toasts={[toast]} />}
      <Status />
    </div>
  );
};
