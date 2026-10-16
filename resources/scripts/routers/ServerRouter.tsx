import TransferListener from '@/components/server/TransferListener';
import React, { useEffect, useState } from 'react';
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import TransitionRouter from '@/TransitionRouter';
import WebsocketHandler from '@/components/server/WebsocketHandler';
import { ServerContext } from '@/state/server';
import Can from '@/components/elements/Can';
import Spinner from '@/components/elements/Spinner';
import { NotFound, ServerError } from '@/components/elements/ScreenBlock';
import { httpErrorToHuman } from '@/api/http';
import { useStoreState } from 'easy-peasy';
import InstallListener from '@/components/server/InstallListener';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { useLocation } from 'react-router';
import ConflictStateRenderer from '@/components/server/ConflictStateRenderer';
import PermissionRoute from '@/components/elements/PermissionRoute';
import routes from '@/routers/routes';

import LunarAppLayout from '@/components/dashboard/LunarAppLayout';
import LunarServerHeader from '@/components/server/LunarServerHeader';
import { ServerViewSkeleton } from '@/components/server/skeletons/ServerViewSkeleton';
import { LicenseLockoutView } from '@/components/votion/LicenseLockoutView';
import { getCachedServer } from '@/lib/serverCache';

const VotionCodeContainer = React.lazy(() => import(/* webpackPrefetch: true */ '@/components/server/votion-code/VotionCodeContainer'));

export default () => {
    const license = (window as any).LunarLicense;
    if (license && !license.valid) {
        return <LicenseLockoutView license={license} />;
    }

    const match = useRouteMatch<{ id: string }>();
    const location = useLocation();

    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [error, setError] = useState('');

    const id = ServerContext.useStoreState((state) => state.server.data?.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const inConflictState = ServerContext.useStoreState((state) => state.server.inConflictState);
    const getServer = ServerContext.useStoreActions((actions) => actions.server.getServer);
    const setServer = ServerContext.useStoreActions((actions) => actions.server.setServer);
    const setPermissions = ServerContext.useStoreActions((actions) => actions.server.setPermissions);
    const clearServerState = ServerContext.useStoreActions((actions) => actions.clearServerState);

    const to = (value: string, url = false) => {
        if (value === '/') {
            return url ? match.url : match.path;
        }
        return `${(url ? match.url : match.path).replace(/\/*$/, '')}/${value.replace(/^\/+/, '')}`;
    };

    useEffect(
        () => () => {
            clearServerState();
        },
        []
    );

    useEffect(() => {
        setError('');

        const cached = getCachedServer(match.params.id);
        if (cached && (!id || (id !== cached.server.id && uuid !== cached.server.uuid))) {
            setServer(cached.server);
            setPermissions(cached.permissions);
        }

        getServer(match.params.id).catch((error) => {
            console.error(error);
            if (!cached && !id) {
                setError(httpErrorToHuman(error));
            }
        });

        return () => {
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/server/')) {
                clearServerState();
            }
        };
    }, [match.params.id]);

    const isVotionCode = location.pathname.includes('/votion-code');

    if (isVotionCode) {
        if (!uuid || !id) {
            return (
                <div className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-[#000000] text-white">
                    {error ? (
                        <ServerError message={error} />
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <Spinner size="large" />
                            <span className="text-xs font-mono text-neutral-400">Opening Votion Code Studio...</span>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#000000] z-50">
                <InstallListener />
                <TransferListener />
                <WebsocketHandler />
                <ErrorBoundary>
                    <Can
                        action={'file.*'}
                        renderOnError={<ServerError message={'You do not have permission to access Votion Code.'} />}
                    >
                        <Spinner.Suspense>
                            <VotionCodeContainer />
                        </Spinner.Suspense>
                    </Can>
                </ErrorBoundary>
            </div>
        );
    }

    return (
        <LunarAppLayout>
            {!uuid || !id ? (
                error ? (
                    <ServerError message={error} />
                ) : (
                    <ServerViewSkeleton />
                )
            ) : (
                <div className="w-full">
                    <LunarServerHeader />
                    <InstallListener />
                    <TransferListener />
                    <WebsocketHandler />
                    {inConflictState && (!rootAdmin || (rootAdmin && !location.pathname.endsWith(`/server/${id}`))) ? (
                        <ConflictStateRenderer />
                    ) : (
                        <ErrorBoundary>
                            <TransitionRouter>
                                <Switch location={location}>
                                    {routes.server.map(({ path, permission, component: Component }) => (
                                        <PermissionRoute key={path} permission={permission} path={to(path)} exact>
                                            <React.Suspense fallback={<ServerViewSkeleton />}>
                                                <Component />
                                            </React.Suspense>
                                        </PermissionRoute>
                                    ))}
                                    <Route path={'*'} component={NotFound} />
                                </Switch>
                            </TransitionRouter>
                        </ErrorBoundary>
                    )}
                </div>
            )}
        </LunarAppLayout>
    );
};
