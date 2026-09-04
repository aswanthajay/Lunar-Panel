import React from 'react';
import Icon from '@/components/elements/Icon';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';
import styles from './style.module.css';
import useFitText from 'use-fit-text';
import CopyOnClick from '@/components/elements/CopyOnClick';

interface StatBlockProps {
    title: string;
    copyOnClick?: string;
    color?: string | undefined;
    icon: IconDefinition;
    children: React.ReactNode;
    className?: string;
}

export default ({ title, copyOnClick, icon, className, children }: StatBlockProps) => {
    const { fontSize, ref } = useFitText({ minFontSize: 8, maxFontSize: 500 });

    return (
        <CopyOnClick text={copyOnClick}>
            <div className={classNames(styles.stat_block, className)}>
                <div className={styles.icon}>
                    <Icon icon={icon} className="text-[#9A9AA2]" />
                </div>
                <div className={'flex flex-col justify-center overflow-hidden w-full min-w-0'}>
                    <p className={'text-[10px] font-bold uppercase tracking-wider text-[#5E5E67] leading-none mb-1'}>
                        {title}
                    </p>
                    <div
                        ref={ref}
                        className={'h-[1.5rem] w-full font-semibold font-mono text-[#FFFFFF] truncate leading-tight'}
                        style={{ fontSize }}
                    >
                        {children}
                    </div>
                </div>
            </div>
        </CopyOnClick>
    );
};
