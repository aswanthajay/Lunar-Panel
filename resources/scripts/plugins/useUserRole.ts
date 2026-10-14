import { useState, useEffect } from 'react';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

export type UserRole = 'admin' | 'client';

export const useUserRole = () => {
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data?.rootAdmin || false);
    const [role, setRole] = useState<UserRole>(() => {
        if (!rootAdmin) return 'client';
        const saved = localStorage.getItem('lunar_user_role');
        return saved === 'client' ? 'client' : 'admin';
    });

    useEffect(() => {
        const handler = () => {
            if (!rootAdmin) {
                setRole('client');
                return;
            }
            const saved = localStorage.getItem('lunar_user_role');
            setRole(saved === 'client' ? 'client' : 'admin');
        };

        window.addEventListener('lunar-role-change', handler);
        return () => window.removeEventListener('lunar-role-change', handler);
    }, [rootAdmin]);

    const toggleRole = () => {
        if (!rootAdmin) return;
        const next: UserRole = role === 'admin' ? 'client' : 'admin';
        localStorage.setItem('lunar_user_role', next);
        setRole(next);
        window.dispatchEvent(new Event('lunar-role-change'));
    };

    const isAdmin = Boolean(rootAdmin && role === 'admin');

    return {
        role: isAdmin ? 'admin' : 'client',
        isAdmin,
        isClient: !isAdmin,
        toggleRole,
        rootAdmin,
    };
};

export default useUserRole;
