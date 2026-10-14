import React from 'react';
import { Skeleton } from './Skeleton';

export interface TableSkeletonColumn {
    width?: string;
    height?: string | number;
    align?: 'left' | 'right' | 'center';
}

export interface TableSkeletonProps {
    rows?: number;
    columns?: number | TableSkeletonColumn[];
    className?: string;
}

/**
 * 1:1 Parity Table Skeleton Rows.
 * Zero layout shift (CLS = 0) with matching padding, borders, and column proportions.
 */
export const TableSkeleton: React.FC<TableSkeletonProps> = ({
    rows = 5,
    columns = 6,
    className = '',
}) => {
    const cols: TableSkeletonColumn[] = Array.isArray(columns)
        ? columns
        : Array.from({ length: columns }, (_, idx) => ({
              width: idx === 0 ? '25%' : idx === columns - 1 ? '15%' : '18%',
              align: idx === columns - 1 ? 'right' : 'left',
          }));

    return (
        <>
            {Array.from({ length: rows }, (_, rowIdx) => (
                <tr key={`table-skel-row-${rowIdx}`} className={`lunar-skeleton-row ${className}`}>
                    {cols.map((col, colIdx) => (
                        <td
                            key={`table-skel-cell-${rowIdx}-${colIdx}`}
                            className={`py-3.5 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                        >
                            <div className={`inline-block w-full ${col.align === 'right' ? 'flex justify-end' : col.align === 'center' ? 'flex justify-center' : ''}`}>
                                <Skeleton
                                    height={16}
                                    width={col.width || '80%'}
                                    rounded="sm"
                                    className={rowIdx % 2 === 0 ? 'opacity-90' : 'opacity-70'}
                                />
                            </div>
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
};

export default TableSkeleton;
