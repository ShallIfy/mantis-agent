'use client';

import { WalletProvider } from '@/lib/wallet/provider';
import type { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      {children}
    </WalletProvider>
  );
}
