'use client';

import Header from '@/app/components/Header';
import { useWallet } from '@/lib/wallet/provider';
import { decryptFromStorage } from '@/lib/wallet/crypto';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import TokenIcon from '@/app/components/TokenIcon';
import {
  Wallet, Plus, Import, Lock, Unlock, Trash2, Copy, Check,
  RefreshCw, ExternalLink, AlertTriangle, Eye, EyeOff, Shield,
  KeyRound, ArrowLeft, Fingerprint, ChevronRight, Download,
} from 'lucide-react';

// ═══════════════════════════════════════════════
// TOKEN METADATA
// ═══════════════════════════════════════════════

const TOKEN_NAMES: Record<string, string> = {
  MNT: 'Mantle',
  WMNT: 'Wrapped Mantle',
  USDC: 'USD Coin',
  USDT0: 'Tether USD',
  WETH: 'Wrapped Ether',
  mETH: 'Mantle Staked ETH',
  cmETH: 'cmETH',
  FBTC: 'Fire Bitcoin',
  wstETH: 'Wrapped stETH',
  USDe: 'Ethena USDe',
  sUSDe: 'Staked USDe',
};

// ═══════════════════════════════════════════════
// BALANCE DISPLAY — integer bright, decimal dim
// ═══════════════════════════════════════════════

function HeroBalance({ value }: { value: string | null }) {
  const num = parseFloat(value || '0');
  const formatted = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const dotIdx = formatted.indexOf('.');
  const integer = dotIdx >= 0 ? formatted.slice(0, dotIdx) : formatted;
  const decimal = dotIdx >= 0 ? formatted.slice(dotIdx) : '.00';

  return (
    <span className="wallet-balance">
      <span className="wb-int">{integer}</span>
      <span className="wb-dec">{decimal}</span>
    </span>
  );
}

function TokenBalance({ value, decimals }: { value: string; decimals: number }) {
  const num = parseFloat(value);
  const maxDec = decimals <= 6 ? 2 : 4;
  const formatted = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: maxDec });
  const dotIdx = formatted.indexOf('.');
  const integer = dotIdx >= 0 ? formatted.slice(0, dotIdx) : formatted;
  const decimal = dotIdx >= 0 ? formatted.slice(dotIdx) : '.00';

  return (
    <span className="wallet-token-balance font-mono text-[14px] font-semibold tabular-nums">
      <span className="wtb-int">{integer}</span>
      <span className="wtb-dec">{decimal}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════
// COPY BUTTON
// ═══════════════════════════════════════════════

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={cn(
        'p-1.5 rounded-lg transition-all duration-200',
        copied
          ? 'text-emerald-400 bg-emerald-400/[0.06]'
          : 'text-white/20 hover:text-white/50 hover:bg-white/[0.04]',
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ═══════════════════════════════════════════════
// NETWORK BADGE
// ═══════════════════════════════════════════════

function NetworkBadge() {
  return (
    <div className="badge badge-green flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      <span>Mantle</span>
    </div>
  );
}

// ═══════════════════════════════════════════════
// PREMIUM INPUT
// ═══════════════════════════════════════════════

function PremiumInput({
  label, type = 'text', value, onChange, placeholder, autoFocus, right, centered,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoFocus?: boolean; right?: React.ReactNode; centered?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="stat-label block">{label}</label>
      <div className="relative group">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            'w-full rounded-2xl text-[13px] bg-white/[0.02] border border-white/[0.06] px-4 py-3',
            'focus:outline-none focus:border-primary/25 focus:bg-white/[0.03]',
            'focus:shadow-[0_0_0_3px_rgba(0,210,110,0.04)]',
            'transition-all duration-300 placeholder:text-white/12',
            right && 'pr-11',
            centered && 'text-center',
          )}
        />
        {right && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {right}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SETUP VIEW — generate or import
// ═══════════════════════════════════════════════

function SetupView() {
  const { generateWallet, importWallet, isLoading, error } = useWallet();
  const [mode, setMode] = useState<'choose' | 'generate' | 'import'>('choose');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showPk, setShowPk] = useState(false);

  const handleGenerate = async () => {
    if (password.length < 6 || password !== confirmPassword) return;
    await generateWallet(password);
  };

  const handleImport = async () => {
    if (password.length < 6 || !privateKey.trim()) return;
    await importWallet(privateKey.trim(), password);
  };

  if (mode === 'choose') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] px-4">
        {/* Hero icon with layered glow */}
        <div className="relative mb-10 animate-in">
          <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-primary/[0.15] via-primary/[0.08] to-transparent flex items-center justify-center border border-primary/[0.12]"
            style={{ animation: 'float 4s ease-in-out infinite' }}
          >
            <Wallet className="w-11 h-11 text-primary/80" />
          </div>
          {/* Outer glow ring */}
          <div className="absolute -inset-4 rounded-[36px] border border-primary/[0.04]" />
          <div className="absolute -inset-6 rounded-[44px] bg-primary/[0.02] blur-2xl pointer-events-none" />
        </div>

        <h2 className="text-2xl font-bold text-white/92 mb-2.5 tracking-tight animate-in stagger-1">
          Setup Wallet
        </h2>
        <p className="text-[13px] text-white/30 mb-12 text-center max-w-xs leading-relaxed animate-in stagger-2">
          Your private key is encrypted and stored in your browser. It never leaves your device.
        </p>

        {/* Option cards — using mantis-card-premium for gradient border hover */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-5 w-full max-w-md animate-in stagger-3">
          <button
            onClick={() => setMode('generate')}
            className="flex-1 mantis-card-premium !p-0 group cursor-pointer text-left"
          >
            <div className="p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/[0.08] flex items-center justify-center mb-5 group-hover:bg-primary/[0.15] group-hover:shadow-[0_0_20px_rgba(0,210,110,0.08)] transition-all duration-300">
                <Plus className="w-5 h-5 text-primary/60 group-hover:text-primary transition-colors duration-300" />
              </div>
              <p className="text-[15px] font-semibold text-white/88 mb-1.5 tracking-tight">Generate New</p>
              <p className="text-[12px] text-white/25 leading-relaxed">Create a fresh wallet on Mantle network</p>
            </div>
            <div className="px-6 py-3.5 border-t border-white/[0.04] flex items-center justify-between">
              <span className="text-[11px] text-primary/40 font-medium">Get started</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/10 group-hover:text-primary/40 group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
          </button>

          <button
            onClick={() => setMode('import')}
            className="flex-1 mantis-card-premium !p-0 group cursor-pointer text-left"
          >
            <div className="p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/[0.08] flex items-center justify-center mb-5 group-hover:bg-primary/[0.15] group-hover:shadow-[0_0_20px_rgba(0,210,110,0.08)] transition-all duration-300">
                <Import className="w-5 h-5 text-primary/60 group-hover:text-primary transition-colors duration-300" />
              </div>
              <p className="text-[15px] font-semibold text-white/88 mb-1.5 tracking-tight">Import Key</p>
              <p className="text-[12px] text-white/25 leading-relaxed">Use an existing private key you already own</p>
            </div>
            <div className="px-6 py-3.5 border-t border-white/[0.04] flex items-center justify-between">
              <span className="text-[11px] text-primary/40 font-medium">Import</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/10 group-hover:text-primary/40 group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
          </button>
        </div>

        {/* Security note */}
        <div className="mt-12 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/[0.06] animate-in stagger-4">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400/40 flex-shrink-0" />
          <span className="text-[11px] text-amber-400/35">Demo wallet — do not import keys with significant funds.</span>
        </div>
      </div>
    );
  }

  // ── Form view (generate or import) ──
  return (
    <div className="flex flex-col items-center min-h-[65vh] justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Back */}
        <button
          onClick={() => setMode('choose')}
          className="flex items-center gap-1.5 text-[12px] text-white/25 hover:text-white/50 transition-colors duration-200 mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        {/* Form card */}
        <div className="mantis-card-premium animate-in">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/[0.08] flex items-center justify-center">
              {mode === 'generate'
                ? <KeyRound className="w-5 h-5 text-primary/70" />
                : <Import className="w-5 h-5 text-primary/70" />
              }
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-white/92 tracking-tight">
                {mode === 'generate' ? 'Generate New Wallet' : 'Import Private Key'}
              </h2>
              <p className="text-[11px] text-white/25 mt-0.5">Mantle Mainnet · Chain ID 5000</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Private key input (import only) */}
            {mode === 'import' && (
              <PremiumInput
                label="Private Key"
                type={showPk ? 'text' : 'password'}
                value={privateKey}
                onChange={setPrivateKey}
                placeholder="0x..."
                right={
                  <button
                    type="button"
                    onClick={() => setShowPk(v => !v)}
                    className="text-white/20 hover:text-white/50 transition-colors"
                  >
                    {showPk ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            )}

            <PremiumInput
              label="Encryption Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Min 6 characters"
            />

            {mode === 'generate' && (
              <PremiumInput
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repeat password"
              />
            )}

            {error && (
              <p className="text-[12px] text-red-400/70 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                {error}
              </p>
            )}

            <button
              onClick={mode === 'generate' ? handleGenerate : handleImport}
              disabled={isLoading || password.length < 6 || (mode === 'generate' && password !== confirmPassword) || (mode === 'import' && !privateKey.trim())}
              className="btn-glow w-full !text-[13px] disabled:opacity-20 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Encrypting...
                </span>
              ) : (
                mode === 'generate' ? 'Generate & Encrypt' : 'Import & Encrypt'
              )}
            </button>
          </div>

          {/* Security footer */}
          <div className="flex items-start gap-2.5 mt-6 pt-5 border-t border-white/[0.04]">
            <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-primary/25" />
            <span className="text-[11px] text-white/18 leading-relaxed">
              Encrypted with AES-256-GCM + PBKDF2 (100k iterations). Your key is stored in this browser only and never transmitted.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// LOCKED VIEW — enter password
// ═══════════════════════════════════════════════

function LockedView() {
  const { address, unlock, isLoading, error } = useWallet();
  const [password, setPassword] = useState('');

  const handleUnlock = async () => {
    if (!password) return;
    await unlock(password);
  };

  return (
    <div className="flex flex-col items-center min-h-[65vh] justify-center px-4">
      {/* Lock icon with layered glow */}
      <div className="relative mb-10 animate-in">
        <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.06] to-transparent flex items-center justify-center border border-amber-500/[0.1]"
          style={{ animation: 'float 4s ease-in-out infinite' }}
        >
          <Lock className="w-11 h-11 text-amber-400/60" />
        </div>
        <div className="absolute -inset-4 rounded-[36px] border border-amber-500/[0.04]" />
        <div className="absolute -inset-6 rounded-[44px] bg-amber-500/[0.02] blur-2xl pointer-events-none" />
      </div>

      <h2 className="text-2xl font-bold text-white/92 mb-3 tracking-tight animate-in stagger-1">
        Wallet Locked
      </h2>

      {/* Address card */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-2 animate-in stagger-2">
        <Fingerprint className="w-3.5 h-3.5 text-white/15" />
        <span className="text-[12px] text-white/30 font-mono tracking-wide">
          {address?.slice(0, 10)}...{address?.slice(-8)}
        </span>
        {address && <CopyButton text={address} />}
      </div>

      <p className="text-[11px] text-white/15 mb-10 animate-in stagger-2">Enter your password to unlock</p>

      <form
        onSubmit={(e) => { e.preventDefault(); handleUnlock(); }}
        className="w-full max-w-xs space-y-4 animate-in stagger-3"
      >
        <PremiumInput
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoFocus
          centered
        />

        {error && (
          <p className="text-[12px] text-red-400/70 text-center flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading || !password}
          className="btn-glow w-full !text-[13px] disabled:opacity-20 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Decrypting...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Unlock className="w-3.5 h-3.5" />
              Unlock Wallet
            </span>
          )}
        </button>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════
// UNLOCKED VIEW — overview + balances
// ═══════════════════════════════════════════════

function UnlockedView() {
  const { address, mntBalance, tokenBalances, lock, removeWallet, refreshBalances } = useWallet();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportPw, setExportPw] = useState('');
  const [exportedPk, setExportedPk] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBalances();
    setIsRefreshing(false);
  };

  const handleExportPk = async () => {
    if (!exportPw) return;
    setExporting(true);
    setExportError(null);
    try {
      const pk = await decryptFromStorage(exportPw);
      setExportedPk(pk);
    } catch {
      setExportError('Wrong password');
    } finally {
      setExporting(false);
    }
  };

  const closeExport = () => {
    setShowExport(false);
    setExportPw('');
    setExportedPk(null);
    setExportError(null);
  };

  const explorerUrl = `https://explorer.mantle.xyz/address/${address}`;

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {/* ── Hero Balance Card ── */}
      <div className="hero-card animate-in">
        <div className="relative z-10">
          {/* Top bar: network + actions */}
          <div className="flex items-center justify-between mb-8">
            <NetworkBadge />
            <div className="flex items-center gap-1">
              <button
                onClick={handleRefresh}
                className="p-2 rounded-xl text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all duration-200"
                title="Refresh"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
              </button>
              <button
                onClick={lock}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium text-white/25 hover:text-amber-400/70 hover:bg-amber-500/[0.04] transition-all duration-200"
              >
                <Lock className="w-3 h-3" />
                Lock
              </button>
            </div>
          </div>

          {/* Balance hero */}
          <div className="mb-8">
            <p className="stat-label mb-3">Balance</p>
            <div className="flex items-baseline gap-3">
              <HeroBalance value={mntBalance} />
            </div>
            <p className="text-[13px] font-medium text-white/25 mt-2">MNT</p>
          </div>

          {/* Address bar */}
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-black/25 border border-white/[0.04] backdrop-blur-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <Fingerprint className="w-3.5 h-3.5 text-white/15 flex-shrink-0" />
              <span className="font-mono text-[12px] text-white/35 truncate">{address}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-3">
              <CopyButton text={address || ''} />
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-white/15 hover:text-white/40 hover:bg-white/[0.04] transition-all duration-200"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Token Assets ── */}
      <div className="mantis-card-premium !p-0 animate-in stagger-1">
        {/* Section header */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3">
          <div className="flex items-center justify-between">
            <span className="section-header">Assets</span>
            <span className="text-[10px] text-white/15 font-mono">
              {1 + tokenBalances.length} token{tokenBalances.length > 0 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Token list */}
        <div>
          {/* MNT — native token */}
          <div className="wallet-token-row flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-white/[0.04]">
            <div className="flex items-center gap-3.5">
              <TokenIcon symbol="MNT" size="lg" />
              <div>
                <p className="text-[14px] font-semibold text-white/88 tracking-tight">MNT</p>
                <p className="text-[11px] text-white/25 mt-0.5">Mantle · Native</p>
              </div>
            </div>
            <TokenBalance value={mntBalance || '0'} decimals={18} />
          </div>

          {/* ERC20 tokens */}
          {tokenBalances.map(t => (
            <div key={t.symbol} className="wallet-token-row flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-white/[0.04]">
              <div className="flex items-center gap-3.5">
                <TokenIcon symbol={t.symbol} size="lg" />
                <div>
                  <p className="text-[14px] font-semibold text-white/88 tracking-tight">{t.symbol}</p>
                  <p className="text-[11px] text-white/25 mt-0.5">{TOKEN_NAMES[t.symbol] || 'ERC-20'}</p>
                </div>
              </div>
              <TokenBalance value={t.balance} decimals={t.decimals} />
            </div>
          ))}

          {/* Empty state */}
          {tokenBalances.length === 0 && mntBalance && parseFloat(mntBalance) === 0 && (
            <div className="px-6 py-10 text-center border-t border-white/[0.04]">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.02] flex items-center justify-center mx-auto mb-3 ring-1 ring-white/[0.04]">
                <Wallet className="w-5 h-5 text-white/10" />
              </div>
              <p className="text-[13px] text-white/20 font-medium">No balances yet</p>
              <p className="text-[11px] text-white/10 mt-1.5 max-w-[240px] mx-auto leading-relaxed">
                Send MNT or ERC-20 tokens to your address to see them here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Export Private Key ── */}
      <div className="mantis-card-premium !p-0 animate-in stagger-2">
        <div className="px-6 py-4">
          {!showExport ? (
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-3 w-full group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/[0.06] flex items-center justify-center group-hover:bg-amber-500/[0.1] transition-colors duration-200">
                <Download className="w-4 h-4 text-amber-400/50 group-hover:text-amber-400/70 transition-colors duration-200" />
              </div>
              <div className="text-left flex-1">
                <p className="text-[13px] font-medium text-white/70 group-hover:text-white/85 transition-colors duration-200">Export Private Key</p>
                <p className="text-[11px] text-white/20 mt-0.5">Reveal your encrypted key with password</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white/25 transition-colors duration-200" />
            </button>
          ) : !exportedPk ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-amber-400/50" />
                  <span className="text-[13px] font-medium text-white/70">Export Private Key</span>
                </div>
                <button onClick={closeExport} className="text-[11px] text-white/20 hover:text-white/40 transition-colors">
                  Cancel
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleExportPk(); }} className="space-y-3">
                <PremiumInput
                  label="Enter Password to Reveal"
                  type="password"
                  value={exportPw}
                  onChange={setExportPw}
                  placeholder="••••••••"
                  autoFocus
                />
                {exportError && (
                  <p className="text-[12px] text-red-400/70 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" />
                    {exportError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={exporting || !exportPw}
                  className={cn(
                    'w-full py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-200',
                    'bg-amber-500/15 text-amber-400/80 border border-amber-500/10',
                    'hover:bg-amber-500/20 hover:border-amber-500/20',
                    'disabled:opacity-25 disabled:cursor-not-allowed',
                  )}
                >
                  {exporting ? 'Decrypting...' : 'Reveal Key'}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400/60" />
                  <span className="text-[13px] font-medium text-red-400/70">Private Key Revealed</span>
                </div>
                <button onClick={closeExport} className="text-[11px] text-white/20 hover:text-white/40 transition-colors">
                  Hide
                </button>
              </div>

              <div className="relative px-4 py-3 rounded-xl bg-red-500/[0.04] border border-red-500/[0.08]">
                <p className="font-mono text-[12px] text-white/60 break-all leading-relaxed pr-8">{exportedPk}</p>
                <div className="absolute right-3 top-3">
                  <CopyButton text={exportedPk} />
                </div>
              </div>

              <p className="text-[11px] text-red-400/40 flex items-center gap-1.5">
                <Shield className="w-3 h-3 flex-shrink-0" />
                Never share your private key. Anyone with it has full access to your funds.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer: encryption info + remove ── */}
      <div className="flex items-center justify-between px-2 py-2 animate-in stagger-2">
        <div className="flex items-center gap-2">
          <Shield className="w-3 h-3 text-primary/20" />
          <span className="text-[10px] text-white/15 font-medium tracking-wide">AES-256-GCM · PBKDF2</span>
        </div>

        {!showRemoveConfirm ? (
          <button
            onClick={() => setShowRemoveConfirm(true)}
            className="text-[10px] text-white/10 hover:text-red-400/50 transition-colors duration-200"
          >
            Remove wallet
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-red-400/40">Remove?</span>
            <button
              onClick={() => { removeWallet(); setShowRemoveConfirm(false); }}
              className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/12 text-red-400/70 hover:bg-red-500/20 transition-all duration-200"
            >
              Yes
            </button>
            <button
              onClick={() => setShowRemoveConfirm(false)}
              className="px-2 py-0.5 rounded text-[10px] text-white/20 hover:text-white/40 transition-colors duration-200"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════

export default function WalletPage() {
  const { hasWallet, isUnlocked, isSecure } = useWallet();

  return (
    <>
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-8">
        {/* HTTP warning — compact, unobtrusive */}
        {!isSecure && typeof window !== 'undefined' && (
          <div className="flex items-center gap-2.5 mb-6 px-4 py-2 rounded-xl bg-amber-500/[0.04] border border-amber-500/[0.06] max-w-lg mx-auto animate-in">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400/40 flex-shrink-0" />
            <span className="text-[11px] text-amber-400/35">HTTP — basic encryption active. Use HTTPS for full AES-256.</span>
          </div>
        )}

        {!hasWallet && <SetupView />}
        {hasWallet && !isUnlocked && <LockedView />}
        {hasWallet && isUnlocked && <UnlockedView />}
      </main>
    </>
  );
}
