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

// Votion feature views
import { InstanceFleetView } from '@/components/votion/InstanceFleetView';
import { BillingOperationsView } from '@/components/votion/BillingOperationsView';
import { ClientBillingView } from '@/components/votion/ClientBillingView';
import { SupportCenterView } from '@/components/votion/SupportCenterView';
import { ClusterAuditLogsView } from '@/components/votion/ClusterAuditLogsView';
import { ReimageRequestsView } from '@/components/votion/ReimageRequestsView';
import { OvhManagerView } from '@/components/votion/OvhManagerView';
import { ProxmoxConnectionsView } from '@/components/votion/ProxmoxConnectionsView';
import { UserManagementView } from '@/components/votion/UserManagementView';
import { SystemSettingsView } from '@/components/votion/SystemSettingsView';

export default () => {
    const { isAdmin } = useUserRole();
    const location = useLocation();

    return (
        <LunarAppLayout>
            <TransitionRouter>
                <React.Suspense fallback={<Spinner centered />}>
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
                        <Route path={'/audit-logs'} exact>
                            {isAdmin ? <ClusterAuditLogsView /> : <Redirect to="/" />}
                        </Route>
                        <Route path={'/reimage-requests'} exact>
                            {isAdmin ? <ReimageRequestsView /> : <Redirect to="/" />}
                        </Route>
                        <Route path={'/ovh-manager'} exact>
                            {isAdmin ? <OvhManagerView /> : <Redirect to="/" />}
                        </Route>
                        <Route path={'/proxmox-connections'} exact>
                            {isAdmin ? <ProxmoxConnectionsView /> : <Redirect to="/" />}
                        </Route>
                        <Route path={'/user-management'} exact>
                            {isAdmin ? <UserManagementView /> : <Redirect to="/" />}
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
