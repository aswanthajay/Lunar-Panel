import React, { useMemo } from 'react';
import { ProductPanelCard, ProductItemData } from './ProductPanelCard';

export interface ProductSection {
    id: string;
    title?: string;
    products: ProductItemData[];
}

export interface ProductPanelsGridProps {
    sections?: ProductSection[] | null;
    isLoading?: boolean;
    error?: Error | string | null;
    onSelectProduct?: (product: ProductItemData) => void;
    emptyTitle?: string;
    emptyMessage?: string;
    onRetry?: () => void;
    skeletonCount?: number;
}

const ProductCardSkeleton: React.FC = () => (
    <div className="w-full sm:w-[296px] min-h-[148px] p-6 bg-[#0E0E11] border border-[#1C1C20] rounded-md flex flex-col justify-between animate-pulse">
        <div>
            <div className="flex items-center justify-between gap-2">
                <div className="h-5 bg-[#1C1C20] rounded w-2/3" />
                <div className="h-4 bg-[#1C1C20] rounded-full w-12" />
            </div>
            <div className="space-y-2 mt-4">
                <div className="h-3.5 bg-[#1C1C20] rounded w-full" />
                <div className="h-3.5 bg-[#1C1C20] rounded w-4/5" />
            </div>
        </div>
    </div>
);

export const ProductPanelsGrid: React.FC<ProductPanelsGridProps> = ({
    sections,
    isLoading = false,
    error,
    onSelectProduct,
    emptyTitle = 'No products available',
    emptyMessage = 'There are currently no products configured for this organization.',
    onRetry,
    skeletonCount = 4,
}) => {
    const totalProducts = useMemo(() => {
        if (!sections || !Array.isArray(sections)) return 0;
        return sections.reduce((acc, section) => acc + (section.products?.length || 0), 0);
    }, [sections]);

    if (error && !isLoading) {
        const errorMessage = typeof error === 'string' ? error : error.message;
        return (
            <div className="w-full bg-[#000000] py-12 px-6">
                <div className="max-w-[1324px] mx-auto">
                    <div className="bg-[#0E0E11] border border-[#3E1A1D] rounded-md p-8 text-center max-w-xl mx-auto">
                        <div className="w-10 h-10 rounded-full bg-[#1F1315] text-[#EF4444] mx-auto flex items-center justify-center mb-3">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-semibold text-[#FFFFFF] mb-1">Failed to load product catalog</h3>
                        <p className="text-xs text-[#9A9AA2] mb-4">{errorMessage}</p>
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="px-4 py-2 bg-[#16161A] hover:bg-[#222228] border border-[#2B2B32] text-xs font-semibold text-[#FFFFFF] rounded transition-colors cursor-pointer"
                            >
                                Retry Request
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <main className="w-full bg-[#000000] py-8 px-6">
                <div className="max-w-[1324px] mx-auto space-y-12">
                    <div>
                        <div className="h-4 bg-[#1C1C20] rounded w-32 mb-6 animate-pulse" />
                        <div className="flex flex-wrap gap-6 justify-start">
                            {Array.from({ length: skeletonCount }).map((_, idx) => (
                                <ProductCardSkeleton key={`skeleton-${idx}`} />
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    if (!sections || totalProducts === 0) {
        return (
            <main className="w-full bg-[#000000] py-12 px-6">
                <div className="max-w-[1324px] mx-auto">
                    <div className="border border-dashed border-[#1C1C20] bg-[#070708] rounded-md p-12 text-center max-w-lg mx-auto">
                        <div className="w-10 h-10 rounded-full bg-[#0E0E11] border border-[#1C1C20] text-[#5E5E67] mx-auto flex items-center justify-center mb-3">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-semibold text-[#FFFFFF] mb-1">{emptyTitle}</h3>
                        <p className="text-xs text-[#5E5E67] leading-relaxed">{emptyMessage}</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="w-full bg-[#000000] py-8 px-6 min-h-full">
            <div className="max-w-[1324px] mx-auto space-y-12">
                {sections.map((section) => {
                    if (!section.products || section.products.length === 0) return null;

                    return (
                        <section key={section.id} className="w-full" aria-labelledby={`section-title-${section.id}`}>
                            {section.title && (
                                <h2
                                    id={`section-title-${section.id}`}
                                    className="text-base font-semibold text-[#FFFFFF] mb-6 tracking-normal"
                                >
                                    {section.title}
                                </h2>
                            )}

                            <div className="flex flex-wrap gap-6 justify-start">
                                {section.products.map((product) => (
                                    <ProductPanelCard
                                        key={product.id}
                                        item={product}
                                        onCardClick={onSelectProduct}
                                        className="w-full sm:w-[296px] min-h-[148px]"
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </main>
    );
};
