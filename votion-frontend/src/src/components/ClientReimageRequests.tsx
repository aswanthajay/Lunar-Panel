import React, { useEffect, useState } from 'react';

export const ClientReimageRequests: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/client/reimage-requests')
      .then(r => r.json())
      .then(d => { if (d.success) setRequests(d.data || []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex-1 p-8 text-votion-50">
      <h1 className="text-2xl font-serif font-medium tracking-[-0.03em] mb-2">My Reimage Requests</h1>
      <p className="text-votion-300 mb-8">View the status of your OS reimage requests.</p>
      
      {isLoading ? (
        <div className="text-votion-300">Loading requests...</div>
      ) : (
        <div className="bg-votion-900 border border-votion-800 rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-votion-950 border-b border-votion-800">
              <tr>
                <th className="p-4">Server ID</th>
                <th className="p-4">Target OS</th>
                <th className="p-4">Status</th>
                <th className="p-4">Requested At</th>
                <th className="p-4">Reviewer Note</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-votion-400">No reimage requests found.</td></tr>
              ) : requests.map(r => (
                <tr key={r.id} className="border-b border-votion-800 last:border-0 hover:bg-votion-800 transition">
                  <td className="p-4 font-mono">{r.vmid}</td>
                  <td className="p-4">{r.requested_os}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      r.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                      r.status === 'approved' ? 'bg-green-900 text-green-300' :
                      r.status === 'completed' ? 'bg-blue-900 text-blue-300' :
                      'bg-red-900 text-red-300'
                    }`}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-sm text-votion-300">{r.reviewer_note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
