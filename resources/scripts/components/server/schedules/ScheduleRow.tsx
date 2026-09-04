import React from 'react';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import tw from 'twin.macro';
import ScheduleCronRow from '@/components/server/schedules/ScheduleCronRow';

export default ({ schedule }: { schedule: Schedule }) => (
    <>
        <div css={tw`hidden md:block`}>
            <FontAwesomeIcon icon={faCalendarAlt} fixedWidth />
        </div>
        <div css={tw`flex-1 md:ml-4`}>
            <p>{schedule.name}</p>
            <p css={tw`text-xs text-neutral-400`}>
                Last run at: {schedule.lastRunAt ? format(schedule.lastRunAt, "MMM do 'at' h:mma") : 'never'}
            </p>
        </div>
        <div>
            <span
                className={`py-1 px-3 rounded-full text-xs font-mono uppercase sm:hidden border ${
                    schedule.isActive
                        ? 'bg-[#051F14] text-[#10B981] border-[#10B981]/40'
                        : 'bg-[#0A0A0A] text-[#707070] border-[#222222]'
                }`}
            >
                {schedule.isActive ? 'Active' : 'Inactive'}
            </span>
        </div>
        <ScheduleCronRow cron={schedule.cron} css={tw`mx-auto sm:mx-8 w-full sm:w-auto mt-4 sm:mt-0`} />
        <div>
            <span
                className={`py-1 px-3 rounded-full text-xs font-mono uppercase hidden sm:inline-block border ${
                    schedule.isProcessing
                        ? 'bg-[#1C1405] text-[#F59E0B] border-[#F59E0B]/40'
                        : schedule.isActive
                        ? 'bg-[#051F14] text-[#10B981] border-[#10B981]/40'
                        : 'bg-[#0A0A0A] text-[#707070] border-[#222222]'
                }`}
            >
                {schedule.isProcessing ? 'Processing' : schedule.isActive ? 'Active' : 'Inactive'}
            </span>
        </div>
    </>
);
