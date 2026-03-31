'use client';

import { useState } from 'react';

const LOGOS = ['agni', 'merchant-moe', 'bybit', 'cian', 'mantle', 'aave'];

export default function UploadPage() {
  const [status, setStatus] = useState<Record<string, string>>({});

  async function handleUpload(name: string, file: File) {
    setStatus((s) => ({ ...s, [name]: 'Uploading...' }));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    const res = await fetch('/api/upload-logo', { method: 'POST', body: fd });
    const json = await res.json();
    if (json.ok) {
      setStatus((s) => ({ ...s, [name]: `Done → ${json.path}` }));
    } else {
      setStatus((s) => ({ ...s, [name]: `Error: ${json.error}` }));
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-2">Logo Upload</h1>
      <p className="text-zinc-400 mb-8">Upload logo files for each platform. Accepted: PNG, JPG, SVG, WebP.</p>

      <div className="grid gap-4 max-w-md">
        {LOGOS.map((name) => (
          <div key={name} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              <img
                src={`/logos/${name}.png`}
                alt={name}
                className="w-10 h-10 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="flex-1">
              <div className="font-medium capitalize">{name.replace('-', ' ')}</div>
              {status[name] && (
                <div className={`text-xs mt-1 ${status[name].startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {status[name]}
                </div>
              )}
            </div>
            <label className="cursor-pointer bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded text-sm transition-colors">
              Choose
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(name, f);
                }}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="mt-8 text-zinc-500 text-sm">
        After uploading, rebuild & restart PM2 for changes to take effect on other pages.
      </div>
    </div>
  );
}
