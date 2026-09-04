import React from 'react';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import classNames from 'classnames';

interface Props {
    cron: Schedule['cron'];
    className?: string;
}

const ScheduleCronRow = ({ cron, className }: Props) => (
    <div className={classNames('flex', className)}>
        <div className={'w-1/5 sm:w-auto text-center'}>
            <p className={'font-mono text-sm text-[#FFFFFF]'}>{cron.minute}</p>
            <p className={'text-[10px] text-[#6B7280] uppercase tracking-wider mt-0.5'}>Minute</p>
        </div>
        <div className={'w-1/5 sm:w-auto text-center ml-4'}>
            <p className={'font-mono text-sm text-[#FFFFFF]'}>{cron.hour}</p>
            <p className={'text-[10px] text-[#6B7280] uppercase tracking-wider mt-0.5'}>Hour</p>
        </div>
        <div className={'w-1/5 sm:w-auto text-center ml-4'}>
            <p className={'font-mono text-sm text-[#FFFFFF]'}>{cron.dayOfMonth}</p>
            <p className={'text-[10px] text-[#6B7280] uppercase tracking-wider mt-0.5'}>Day (Mo)</p>
        </div>
        <div className={'w-1/5 sm:w-auto text-center ml-4'}>
            <p className={'font-mono text-sm text-[#FFFFFF]'}>{cron.month}</p>
            <p className={'text-[10px] text-[#6B7280] uppercase tracking-wider mt-0.5'}>Month</p>
        </div>
        <div className={'w-1/5 sm:w-auto text-center ml-4'}>
            <p className={'font-mono text-sm text-[#FFFFFF]'}>{cron.dayOfWeek}</p>
            <p className={'text-[10px] text-[#6B7280] uppercase tracking-wider mt-0.5'}>Day (Wk)</p>
        </div>
    </div>
);

export default ScheduleCronRow;
