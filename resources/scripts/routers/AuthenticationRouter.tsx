import React from 'react';
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import VotionAuthPages from '@/components/auth/VotionAuthPages';
import { NotFound } from '@/components/elements/ScreenBlock';
import { useHistory, useLocation } from 'react-router';

export default () => {
    const history = useHistory();
    const location = useLocation();
    const { path } = useRouteMatch();

    return (
        <div className={'w-full min-h-screen'}>
            <Switch location={location}>
                <Route path={`${path}/login`} exact>
                    <VotionAuthPages initialMode={'login'} />
                </Route>
                <Route path={`${path}/register`} exact>
                    <VotionAuthPages initialMode={'register'} />
                </Route>
                <Route path={`${path}/password`} exact>
                    <VotionAuthPages initialMode={'forgot-password'} />
                </Route>
                <Route path={`${path}/password/reset/:token`}>
                    <VotionAuthPages initialMode={'reset-password'} />
                </Route>
                <Route path={`${path}/login/checkpoint`}>
                    <VotionAuthPages initialMode={'2fa'} />
                </Route>
                <Route path={`${path}/checkpoint`}>
                    <VotionAuthPages initialMode={'2fa'} />
                </Route>
                <Route path={'*'}>
                    <NotFound onBack={() => history.push('/auth/login')} />
                </Route>
            </Switch>
        </div>
    );
};
