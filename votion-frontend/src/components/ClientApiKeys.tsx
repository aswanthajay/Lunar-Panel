import React, { useEffect, useState } from 'react';


export const ClientApiKeys: React.FC = () => {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [name, setName] = useState('');

  const loadKeys = () => {
    fetch('/api/v1/user/api-keys')
      .then(r => r.json())
      .then(d => { if (d.success) setKeys(d.data); });
  };

  useEffect(() => { loadKeys(); }, []);

  const createKey = async () => {
    const r = await fetch('/api/v1/user/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const d = await r.json();
    if (d.success) {
      setNewKey(d.rawKey);
      setName('');
      loadKeys();
    }
  };

  const deleteKey = async (id: number) => {
    await fetch(`/api/v1/user/api-keys/${id}`, { method: 'DELETE' });
    loadKeys();
  };

  return (
    <div className="flex-1 p-8 text-votion-50">
      <h1 className="text-2xl font-serif font-medium tracking-[-0.03em] mb-2">API Access Keys</h1><p className="text-votion-300">Generate tokens to access the Votion API programmatically.</p>
      <div className="max-w-4xl mt-8">
        {newKey && (
          <div className="bg-votion-800 border border-votion-accent p-4 mb-8 rounded">
            <h3 className="text-votion-accent font-semibold mb-2">Save your new API Key!</h3>
            <p className="mb-2">You will not be able to see this key again.</p>
            <code className="block bg-black p-3 rounded text-votion-100">{newKey}</code>
            <button onClick={() => setNewKey(null)} className="mt-4 px-4 py-1 text-sm bg-votion-700 rounded">Dismiss</button>
          </div>
        )}

        <div className="flex gap-4 mb-8">
          <input 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="Key Name (e.g., CI/CD Pipeline)" 
            className="flex-1 bg-votion-900 border border-votion-700 px-4 py-2 rounded" 
          />
          <button onClick={createKey} className="px-6 py-2 bg-votion-accent text-black font-semibold rounded">Create Key</button>
        </div>

        <div className="bg-votion-900 border border-votion-800 rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-votion-950 border-b border-votion-800">
              <tr><th className="p-4">Name</th><th className="p-4">Prefix</th><th className="p-4">Created</th><th className="p-4 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} className="border-b border-votion-800 last:border-0">
                  <td className="p-4">{k.name}</td>
                  <td className="p-4 font-mono text-sm">{k.key_prefix}****</td>
                  <td className="p-4">{new Date(k.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => deleteKey(k.id)} className="text-red-400 hover:text-red-300">Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
