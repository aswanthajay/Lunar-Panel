import React, { useState } from 'react';
import { Redirect } from 'react-router-dom';
import { useUserRole } from '@/plugins/useUserRole';
import { Route, Switch, useLocation } from 'react-router-dom';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import { NotFound } from '@/components/elements/ScreenBlock';
import TransitionRouter from '@/TransitionRouter';
import Spinner from '@/components/elements/Spinner';
import routes from '@/routers/routes';
import LunarAppLayout from '@/components/dashboard/LunarAppLayout';
import UserSettingsLayout from '@/components/dashboard/UserSettingsLayout';
import { DashboardSkeleton } from '@/components/dashboard/skeletons/DashboardSkeleton';

// Votion feature views
import { InstanceFleetView } from '@/components/votion/InstanceFleetView';
import { BillingOperationsView } from '@/components/votion/BillingOperationsView';
import { ClientBillingView } from '@/components/votion/ClientBillingView';
import { SupportCenterView } from '@/components/votion/SupportCenterView';
import { SystemSettingsView } from '@/components/votion/SystemSettingsView';
import { LicenseLockoutView } from '@/components/votion/LicenseLockoutView';

export default () => {
    const { isAdmin } = useUserRole();
    const location = useLocation();

    const license = (window as any).LunarLicense;
    if (license && !license.valid) {
        return <LicenseLockoutView license={license} />;
    }

    return (
        <LunarAppLayout>
            <TransitionRouter>
                <React.Suspense fallback={<DashboardSkeleton />}>
                    <Switch location={location}>
                        <Route path={'/'} exact>
                            <DashboardContainer />
                        </Route>
                        <Route path={'/overview'} exact>
                            <DashboardContainer />
                        </Route>
                        <Route path={'/instances'} exact>
                            <InstanceFleetView />
                        </Route>
                        <Route path={'/billing'} exact>
                            <ClientBillingView />
                        </Route>
                        <Route path={'/billing-operations'} exact>
                            {isAdmin ? <BillingOperationsView /> : <Redirect to="/" />}
                        </Route>
                        <Route path={'/support'} exact>
                            <SupportCenterView />
                        </Route>
                        <Route path={'/system-settings'} exact>
                            {isAdmin ? <SystemSettingsView /> : <Redirect to="/" />}
                        </Route>

                        {/* User Account / Settings Routes with Votion Principle Philosophy Layout */}
                        {routes.account.map(({ path, component: Component }) => (
                            <Route key={path} path={`/account/${path}`.replace('//', '/')} exact>
                                <UserSettingsLayout>
                                    <Component />
                                </UserSettingsLayout>
                            </Route>
                        ))}

                        <Route path={'*'}>
                            <NotFound />
                        </Route>
                    </Switch>
                </React.Suspense>
            </TransitionRouter>
        </LunarAppLayout>
    );
};
