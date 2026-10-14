import React from 'react';
import { Link } from 'react-router-dom';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import Translate from '@/components/elements/Translate';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ActivityLog } from '@definitions/user';
import ActivityLogMetaButton from '@/components/elements/activity/ActivityLogMetaButton';
import style from './style.module.css';
import useLocationHash from '@/plugins/useLocationHash';
import { getObjectKeys, isObject } from '@/lib/objects';

interface Props {
    activity: ActivityLog;
    children?: React.ReactNode;
}

function wrapProperties(value: unknown): any {
    if (value === null || typeof value === 'string' || typeof value === 'number') {
        return `<strong>${String(value)}</strong>`;
    }

    if (isObject(value)) {
        return getObjectKeys(value).reduce((obj, key) => {
            if (key === 'count' || (typeof key === 'string' && key.endsWith('_count'))) {
                return { ...obj, [key]: value[key] };
            }
            return { ...obj, [key]: wrapProperties(value[key]) };
        }, {} as Record<string, unknown>);
    }

    if (Array.isArray(value)) {
        return value.map(wrapProperties);
    }

    return value;
}

export default ({ activity, children }: Props) => {
    const { pathTo } = useLocationHash();
    const actor = activity.relationships.actor;
    const properties = wrapProperties(activity.properties);

    const initials = actor?.username
        ? actor.username.slice(0, 2).toUpperCase()
        : 'SY';

    const evLower = activity.event.toLowerCase();
    const isSuccess = evLower.includes('success') || (evLower.includes('login') && !evLower.includes('fail'));
    const isFailure = evLower.includes('fail') || evLower.includes('error') || evLower.includes('delete') || evLower.includes('denied');

    return (
        <div className="px-6 py-4 hover:bg-[#050505] transition-colors flex items-start gap-4 select-none group">
            {/* Minimalist Initials Avatar Badge */}
            <div className="w-8 h-8 rounded-lg bg-[#0A0A0A] border border-[#1F1F1F] flex items-center justify-center shrink-0 font-mono text-[11px] font-semibold text-[#8A8A8A] group-hover:text-[#FFFFFF] group-hover:border-[#383838] transition-colors shadow-sm">
                {initials}
            </div>

            {/* Event Details */}
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <Tooltip placement={'top'} content={actor?.email || 'System User'}>
                        <span className="text-xs font-semibold text-[#FFFFFF] font-sans">
                            {actor?.username || 'System'}
                        </span>
                    </Tooltip>

                    <span className="text-[#313131] text-xs select-none">&bull;</span>

                    {/* Status-aware Event Pill Capsule */}
                    <Link
                        to={`#${pathTo({ event: activity.event })}`}
                        className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full transition-all uppercase tracking-wider no-underline inline-flex items-center gap-1.5 ${
                            isSuccess
                                ? 'bg-[#051F14] text-[#10B981] border border-[#10B981]/35 hover:border-[#10B981]/60 font-semibold'
                                : isFailure
                                ? 'bg-[#1F080A] text-[#EF4444] border border-[#EF4444]/35 hover:border-[#EF4444]/60 font-semibold'
                                : 'bg-[#0A0A0A] text-[#8A8A8A] border border-[#1F1F1F] hover:text-[#FFFFFF] hover:border-[#383838]'
                        }`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${
                                isSuccess ? 'bg-[#10B981]' : isFailure ? 'bg-[#EF4444]' : 'bg-[#525252]'
                            }`}
                        />
                        <span>{activity.event}</span>
                    </Link>

                    {activity.isApi && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0A0A0A] text-[#D4D4D4] border border-[#262626] uppercase tracking-wider">
                            API
                        </span>
                    )}

                    {activity.event.startsWith('server:sftp.') && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#051F14] text-[#10B981] border border-[#10B981]/30 uppercase tracking-wider">
                            SFTP
                        </span>
                    )}

                    {children}
                </div>

                {/* Formatted action description with styled code tags */}
                <div className={style.description}>
                    <Translate ns={'activity'} values={properties} i18nKey={activity.event.replace(':', '.')} />
                </div>

                {/* Metadata footnote: IP address pill & relative time */}
                <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-[#525252]">
                    {activity.ip && (
                        <>
                            <span className="bg-[#050505] text-[#8A8A8A] border border-[#1F1F1F] px-1.5 py-0.5 rounded text-[10px]">
                                {activity.ip}
                            </span>
                            <span>&bull;</span>
                        </>
                    )}
                    <Tooltip placement={'right'} content={format(activity.timestamp, 'MMM do, yyyy H:mm:ss')}>
                        <span className="cursor-help text-[#656B6B] hover:text-[#A0A0A0] transition-colors">
                            {formatDistanceToNowStrict(activity.timestamp, { addSuffix: true })}
                        </span>
                    </Tooltip>
                </div>
            </div>

            {/* Additional Meta Modal Button */}
            {activity.hasAdditionalMetadata && (
                <div className="shrink-0 self-center">
                    <ActivityLogMetaButton meta={activity.properties} />
                </div>
            )}
        </div>
    );
};
