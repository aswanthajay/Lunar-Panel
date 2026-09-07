import React, { useState, useRef, useEffect } from 'react';

interface Props {
    title: string;
    url: string;
    onClose: () => void;
}

export const AudioMiniPlayer: React.FC<Props> = ({ title, url, onClose }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        setIsPlaying(true);
        if (audioRef.current) {
            audioRef.current.play().catch(() => setIsPlaying(false));
        }
    }, [url]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
        }
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds) || seconds <= 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100%-2rem)] sm:w-80 bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl shadow-2xl p-3 select-none animate-slide-up backdrop-blur-md">
            <audio
                ref={audioRef}
                src={url}
                autoPlay
                onTimeUpdate={() => {
                    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
                }}
                onLoadedMetadata={() => {
                    if (audioRef.current) setDuration(audioRef.current.duration);
                }}
                onEnded={() => setIsPlaying(false)}
            />

            <div className="flex items-center justify-between gap-2.5 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="font-mono text-xs text-white font-medium truncate" title={title}>
                        {title}
                    </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={togglePlay}
                        className="p-1 rounded-full text-white hover:bg-[#1F1F1F] transition-colors"
                    >
                        {isPlaying ? (
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded text-[#737373] hover:text-white transition-colors"
                        title="Close player"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Micro Scrub Bar */}
            <div className="w-full">
                <div className="h-1 w-full bg-[#141414] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-150"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-[#737373] mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
};
