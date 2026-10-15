import React from 'react';
import { Trans, TransProps, useTranslation } from 'react-i18next';

type Props = Omit<TransProps, 't'>;

const Translate: React.FC<Props> = ({ ns, children, defaults, ...props }) => {
    const { t, i18n } = useTranslation(ns);
    const resolvedDefaults = defaults || (props.i18nKey ? String(props.i18nKey) : undefined);
    const resolvedChildren = children ?? resolvedDefaults ?? null;

    return (
        <Trans i18n={i18n} t={t} defaults={resolvedDefaults} {...props}>
            {resolvedChildren}
        </Trans>
    );
};

export default Translate;
