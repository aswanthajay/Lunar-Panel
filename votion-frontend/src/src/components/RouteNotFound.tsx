import React from 'react';
import { useNavigate } from 'react-router-dom';

export const RouteNotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="app-content" role="main">
      <section className="mx-auto flex min-h-[420px] max-w-[640px] flex-col items-center justify-center rounded-xl border border-[#dedfdf] bg-white px-6 py-16 text-center shadow-sm">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#656b6b]">Error 404</p>
        <h1 className="page-heading mb-3 mt-3">Page not found</h1>
        <p className="max-w-[440px] text-sm leading-6 text-[#656b6b]">
          This destination is unavailable or has moved. Return to the dashboard to continue managing your cluster.
        </p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="btn-primary mt-6 cursor-pointer"
        >
          Return to dashboard
        </button>
      </section>
    </main>
  );
};
