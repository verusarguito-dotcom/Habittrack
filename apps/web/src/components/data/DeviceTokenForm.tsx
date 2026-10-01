import React, { useState, useEffect } from 'react';
import { KeyIcon, CheckCircleIcon } from '../common/Icons.js';
import { DEVICE_TOKEN_KEY } from '../../utils/exportImport.js';

export interface DeviceTokenFormProps {
  onTokenSaved?: (token: string) => void;
}

export const DeviceTokenForm: React.FC<DeviceTokenFormProps> = ({ onTokenSaved }) => {
  const [tokenInput, setTokenInput] = useState<string>('');
  const [hasExistingToken, setHasExistingToken] = useState<boolean>(false);
  const [showToken, setShowToken] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const existing = localStorage.getItem(DEVICE_TOKEN_KEY);
        if (existing) {
          setHasExistingToken(true);
          setTokenInput(existing);
        }
      }
    } catch (err) {
      console.warn('Failed to load device token from localStorage:', err);
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim();
    try {
      if (typeof localStorage !== 'undefined') {
        if (cleanToken) {
          localStorage.setItem(DEVICE_TOKEN_KEY, cleanToken);
          setHasExistingToken(true);
        } else {
          localStorage.removeItem(DEVICE_TOKEN_KEY);
          setHasExistingToken(false);
        }
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
      if (onTokenSaved) {
        onTokenSaved(cleanToken);
      }
    } catch (err) {
      console.error('Failed to save device token:', err);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
          <KeyIcon className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Autentikasi Token Perangkat (Device Token)
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Bearer token rahasia untuk otorisasi sinkronisasi ke server VPS (PRD §8.3)
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-3 pt-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="device-token-input" className="font-medium text-slate-700 dark:text-slate-300">
              API Bearer Token
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {hasExistingToken ? 'Status: Terkonfigurasi' : 'Status: Belum diatur'}
            </span>
          </div>

          <div className="relative flex items-center">
            <input
              id="device-token-input"
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Masukkan Device Token (misal: vh_tok_...)"
              className="w-full px-3.5 py-2.5 pr-20 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              {showToken ? 'Sembunyikan' : 'Lihat'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
            Disimpan aman di penyimpanan lokal peramban. Tidak pernah diunggah atau dibagikan ke pihak ketiga.
          </p>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
          >
            {isSaved ? (
              <>
                <CheckCircleIcon className="w-3.5 h-3.5" />
                <span>Tersimpan!</span>
              </>
            ) : (
              <span>Simpan Token</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
