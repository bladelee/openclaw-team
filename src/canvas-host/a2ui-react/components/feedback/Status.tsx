/**
 * Status Component
 * Displays pending action status with spinner
 */

import React from 'react';
import { useA2uiAction } from '../../context/A2uiActionContext';
import { Spinner } from './Spinner';
import './Status.module.css';

export const Status: React.FC = () => {
  const { pendingAction } = useA2uiAction();

  if (!pendingAction) {
    return null;
  }

  const { phase, name } = pendingAction;

  return (
    <div className="a2ui-status">
      <Spinner size="small" />
      <span className="a2ui-status-text">
        {phase === 'sending' && `正在执行: ${name}...`}
        {phase === 'sent' && `已完成: ${name}`}
        {phase === 'error' && `执行失败: ${name}`}
      </span>
    </div>
  );
};
