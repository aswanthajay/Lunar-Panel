import React, { useEffect, useState } from 'react';
import { Server } from '@/api/server/getServer';
import getServers from '@/api/getServers';
import ServerRow from '@/components/dashboard/ServerRow';
import Spinner from '@/components/elements/Spinner';
import PageContentBlock from '@/components/elements/PageContentBlock';
import useFlash from '@/plugins/useFlash';
import { useStoreState } from 'easy-peasy';
import { usePersistedState } from '@/plugins/usePersistedState';
import Switch from '@/components/elements/Switch';
import tw from 'twin.macro';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import Pagination from '@/components/elements/Pagination';
import { useLocation } from 'react-router-dom';

import LunarDashboard from '@/components/dashboard/LunarDashboard';
import { DashboardSkeleton } from '@/components/dashboard/skeletons/DashboardSkeleton';
import { VotionCloudPreloader } from '@/components/votion/RouteLoading';

import { useUserRole } from '@/plugins/useUserRole';

export default () => {
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');

    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const uuid = useStoreState((state) => state.user.data!.uuid);
    const { isAdmin, rootAdmin } = useUserRole();
    const [showOnlyAdmin, setShowOnlyAdmin] = usePersistedState(`${uuid}:show_all_servers`, false);

    // Reset pagination to first page whenever switching between Admin View and Client View
    useEffect(() => {
        setPage(1);
    }, [isAdmin]);

    const { data: servers, error } = useSWR<PaginatedResult<Server>>(
        ['/api/client/servers', isAdmin, page],
        () => getServers({ page, perPage: 25, type: isAdmin ? 'admin-all' : undefined })
    );

    useEffect(() => {
        if (!servers) return;
        if (servers.pagination.currentPage > 1 && !servers.items.length) {
            setPage(1);
        }
    }, [servers?.pagination.currentPage]);

    useEffect(() => {
        // Don't use react-router to handle changing this part of the URL, otherwise it
        // triggers a needless re-render. We just want to track this in the URL incase the
        // user refreshes the page.
        window.history.replaceState(null, document.title, `/${page <= 1 ? '' : `?page=${page}`}`);
    }, [page]);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'dashboard', error });
        if (!error) clearFlashes('dashboard');
    }, [error]);

    return (
        <div className="w-full">
            {!servers ? (
                <VotionCloudPreloader />
            ) : (
                <LunarDashboard
                    servers={servers}
                    page={page}
                    onPageSelect={(newPage) => setPage(newPage)}
                    rootAdmin={rootAdmin}
                    showOnlyAdmin={showOnlyAdmin}
                    setShowOnlyAdmin={setShowOnlyAdmin}
                />
            )}
        </div>
    );
};
