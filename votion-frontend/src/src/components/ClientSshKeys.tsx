import React, { useEffect, useState } from 'react';


export const ClientSshKeys: React.FC = () => {
  const [sshKeys, setSshKeys] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/user/ssh-keys')
      .then(r => r.json())
      .then(d => { if (d.success) setSshKeys(d.data || ''); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  const saveKeys = async () => {
    setIsSaving(true);
    await fetch('/api/v1/user/ssh-keys', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sshKeys })
    });
    setIsSaving(false);
    alert('SSH public keys saved successfully. Newly provisioned servers will automatically deploy with these keys.');
  };

  return (
    <div className="flex-1 p-8 text-votion-50">
      <h1 className="text-2xl font-serif font-medium tracking-[-0.03em] mb-2">SSH Public Keys</h1><p className="text-votion-300">Manage public SSH keys automatically installed during server provisioning.</p>
      <div className="max-w-3xl mt-8">
        <textarea
          value={sshKeys}
          onChange={e => setSshKeys(e.target.value)}
          className="w-full h-64 bg-votion-900 border border-votion-700 text-votion-50 p-4 font-mono text-sm rounded-lg"
          placeholder="ssh-rsa AAAAB3Nza... user@hostname"
          disabled={isLoading}
        />
        <button
          onClick={saveKeys}
          disabled={isSaving || isLoading}
          className="mt-4 px-6 py-2 bg-votion-accent text-black font-semibold rounded hover:bg-opacity-90"
        >
          {isSaving ? 'Saving...' : 'Save Keys'}
        </button>
      </div>
    </div>
  );
};
