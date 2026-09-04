import React, { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import getServerSchedule from '@/api/server/schedules/getServerSchedule';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import EditScheduleModal from '@/components/server/schedules/EditScheduleModal';
import NewTaskButton from '@/components/server/schedules/NewTaskButton';
import DeleteScheduleButton from '@/components/server/schedules/DeleteScheduleButton';
import Can from '@/components/elements/Can';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import PageContentBlock from '@/components/elements/PageContentBlock';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import ScheduleTaskRow from '@/components/server/schedules/ScheduleTaskRow';
import isEqual from 'react-fast-compare';
import { format } from 'date-fns';
import ScheduleCronRow from '@/components/server/schedules/ScheduleCronRow';
import RunScheduleButton from '@/components/server/schedules/RunScheduleButton';

interface Params {
    id: string;
}

const CronBox = ({ title, value }: { title: string; value: string }) => (
    <div className={'bg-[#000000] border border-[#1F1F1F] rounded-md p-3 text-center'}>
        <p className={'text-[10px] uppercase tracking-wider text-[#6B7280] font-sans m-0'}>{title}</p>
        <p className={'text-lg font-mono font-medium text-[#FFFFFF] mt-1 m-0'}>{value}</p>
    </div>
);

const ActivePill = ({ active }: { active: boolean }) => (
    <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-mono ml-4 uppercase border ${
            active ? 'bg-[#051F14] text-[#10B981] border-[#10B981]/40' : 'bg-[#0A0A0A] text-[#707070] border-[#222222]'
        }`}
    >
        {active ? 'Active' : 'Inactive'}
    </span>
);

export default () => {
    const history = useHistory();
    const { id: scheduleId } = useParams<Params>();

    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const [isLoading, setIsLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);

    const schedule = ServerContext.useStoreState(
        (st) => st.schedules.data.find((s) => s.id === Number(scheduleId)),
        isEqual
    );
    const appendSchedule = ServerContext.useStoreActions((actions) => actions.schedules.appendSchedule);

    useEffect(() => {
        if (schedule?.id === Number(scheduleId)) {
            setIsLoading(false);
            return;
        }

        clearFlashes('schedules');
        getServerSchedule(uuid, Number(scheduleId))
            .then((schedule) => appendSchedule(schedule))
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ error, key: 'schedules' });
            })
            .then(() => setIsLoading(false));
    }, [scheduleId]);

    const toggleEditModal = useCallback(() => {
        setShowEditModal((s) => !s);
    }, []);

    return (
        <PageContentBlock title={'Schedules'}>
            <FlashMessageRender byKey={'schedules'} css={tw`mb-4`} />
            {!schedule || isLoading ? (
                <Spinner size={'large'} centered />
            ) : (
                <>
                    <ScheduleCronRow cron={schedule.cron} className={'sm:hidden bg-[#000000] border border-[#1F1F1F] rounded-md mb-4 p-3'} />
                    <div className={'rounded-md overflow-hidden'}>
                        <div
                            className={'sm:flex items-center bg-[#000000] border border-[#1F1F1F] p-5 sm:p-6 rounded-t-md'}
                        >
                            <div css={tw`flex-1`}>
                                <h3 className={'flex items-center text-[#FFFFFF] font-serif text-2xl m-0'}>
                                    {schedule.name}
                                    {schedule.isProcessing ? (
                                        <span
                                            className={'flex items-center rounded-full px-2.5 py-0.5 text-xs ml-4 uppercase bg-[#1C1405] text-[#F59E0B] border border-[#F59E0B]/40 font-mono'}
                                        >
                                            <Spinner css={tw`w-3! h-3! mr-2`} />
                                            Processing
                                        </span>
                                    ) : (
                                        <ActivePill active={schedule.isActive} />
                                    )}
                                </h3>
                                <p className={'mt-1 text-sm text-[#8A8A8A] font-sans m-0'}>
                                    Last run at:&nbsp;
                                    {schedule.lastRunAt ? (
                                        <span className={'text-[#FFFFFF]'}>{format(schedule.lastRunAt, "MMM do 'at' h:mma")}</span>
                                    ) : (
                                        <span className={'text-[#6B7280]'}>n/a</span>
                                    )}
                                    <span className={'ml-4 pl-4 border-l border-[#1F1F1F] py-px'}>
                                        Next run at:&nbsp;
                                        {schedule.nextRunAt ? (
                                            <span className={'text-[#FFFFFF]'}>{format(schedule.nextRunAt, "MMM do 'at' h:mma")}</span>
                                        ) : (
                                            <span className={'text-[#6B7280]'}>n/a</span>
                                        )}
                                    </span>
                                </p>
                            </div>
                            <div css={tw`flex sm:block mt-3 sm:mt-0`}>
                                <Can action={'schedule.update'}>
                                    <Button.Text className={'flex-1 mr-4'} onClick={toggleEditModal}>
                                        Edit
                                    </Button.Text>
                                    <NewTaskButton schedule={schedule} />
                                </Can>
                            </div>
                        </div>
                        <div css={tw`hidden sm:grid grid-cols-5 md:grid-cols-5 gap-3 mb-4 mt-4`}>
                            <CronBox title={'Minute'} value={schedule.cron.minute} />
                            <CronBox title={'Hour'} value={schedule.cron.hour} />
                            <CronBox title={'Day (Month)'} value={schedule.cron.dayOfMonth} />
                            <CronBox title={'Month'} value={schedule.cron.month} />
                            <CronBox title={'Day (Week)'} value={schedule.cron.dayOfWeek} />
                        </div>
                        <div className={'bg-[#000000] border border-[#1F1F1F] rounded-b-md divide-y divide-[#141414]'}>
                            {schedule.tasks.length > 0
                                ? schedule.tasks
                                      .sort((a, b) =>
                                          a.sequenceId === b.sequenceId ? 0 : a.sequenceId > b.sequenceId ? 1 : -1
                                      )
                                      .map((task) => (
                                          <ScheduleTaskRow
                                              key={`${schedule.id}_${task.id}`}
                                              task={task}
                                              schedule={schedule}
                                          />
                                      ))
                                : null}
                        </div>
                    </div>
                    <EditScheduleModal visible={showEditModal} schedule={schedule} onModalDismissed={toggleEditModal} />
                    <div css={tw`mt-6 flex sm:justify-end`}>
                        <Can action={'schedule.delete'}>
                            <DeleteScheduleButton
                                scheduleId={schedule.id}
                                onDeleted={() => history.push(`/server/${id}/schedules`)}
                            />
                        </Can>
                        {schedule.tasks.length > 0 && (
                            <Can action={'schedule.update'}>
                                <RunScheduleButton schedule={schedule} />
                            </Can>
                        )}
                    </div>
                </>
            )}
        </PageContentBlock>
    );
};
