import React, { useState, useEffect, useRef } from 'react';
import { ServerContext } from '@/state/server';
import getFileDownloadUrl from '@/api/server/files/getFileDownloadUrl';
import { getMediaType, MediaType } from './mediaUtils';
import { bytesToString } from '@/lib/formatters';
import { PulseLoader } from '@/components/elements/Spinner';

interface Props {
    visible: boolean;
    fileName: string;
    filePath: string;
    fileSize?: number;
    onDismiss: () => void;
    onPlayInBackground?: (title: string, url: string) => void;
}

export const MediaPlayerModal: React.FC<Props> = ({
    visible,
    fileName,
    filePath,
    fileSize,
    onDismiss,
    onPlayInBackground,
}) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Image view state
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Audio view state
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isLooping, setIsLooping] = useState(false);

    const mediaType: MediaType = getMediaType(fileName) || 'image';

    useEffect(() => {
        if (!visible || !filePath) return;

        setLoading(true);
        setError(null);
        setZoom(1);
        setRotation(0);
        setIsPlaying(false);
        setCurrentTime(0);

        getFileDownloadUrl(uuid, filePath)
            .then((url) => {
                setMediaUrl(url);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setError('Failed to fetch media streaming URL from daemon.');
                setLoading(false);
            });
    }, [visible, filePath, uuid]);

    const formatTime = (seconds: number) => {
        if (isNaN(seconds) || seconds <= 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const togglePlayAudio = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in select-none"
            onClick={onDismiss}
        >
            <div
                className="bg-[#050505] border border-[#1F1F1F] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-[#141414] bg-[#0A0A0A] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shrink-0" />
                        <span className="font-mono text-xs font-semibold text-white truncate" title={fileName}>
                            {fileName}
                        </span>
                        {fileSize !== undefined && fileSize > 0 && (
                            <span className="text-[10px] font-mono text-[#737373] shrink-0">
                                ({bytesToString(fileSize)})
                            </span>
                        )}
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#141414] text-[#A0A0A0] border border-[#262626] shrink-0">
                            {mediaType}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {mediaType === 'audio' && mediaUrl && onPlayInBackground && (
                            <button
                                type="button"
                                onClick={() => {
                                    onPlayInBackground(fileName, mediaUrl);
                                    onDismiss();
                                }}
                                className="px-2.5 py-1 text-[11px] font-mono rounded bg-[#141414] hover:bg-[#1F1F1F] text-[#A0A0A0] hover:text-white border border-[#262626] transition-colors flex items-center gap-1.5"
                                title="Continue listening in background mini-player"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                                </svg>
                                <span className="hidden sm:inline">Mini Player</span>
                            </button>
                        )}

                        {mediaUrl && (
                            <a
                                href={mediaUrl}
                                download={fileName}
                                className="p-1.5 rounded text-[#A0A0A0] hover:text-white hover:bg-[#141414] transition-colors"
                                title="Download media"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </a>
                        )}

                        <button
                            type="button"
                            onClick={onDismiss}
                            className="p-1.5 rounded text-[#A0A0A0] hover:text-white hover:bg-[#141414] transition-colors"
                            title="Close"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-[#000000] relative min-h-[260px]">
                    {loading && (
                        <div className="flex flex-col items-center gap-3 text-xs font-mono text-[#A0A0A0]">
                            <PulseLoader size="large" />
                            <span>Loading media stream from node...</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono text-center">
                            {error}
                        </div>
                    )}

                    {!loading && !error && mediaUrl && (
                        <>
                            {/* --- IMAGE VIEWER --- */}
                            {mediaType === 'image' && (
                                <div className="flex flex-col items-center justify-center w-full h-full">
                                    <div className="overflow-auto max-h-[60vh] max-w-full flex items-center justify-center p-2">
                                        <img
                                            src={mediaUrl}
                                            alt={fileName}
                                            style={{
                                                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                                transition: 'transform 0.15s ease-out',
                                            }}
                                            className="max-h-[55vh] max-w-full object-contain rounded select-none shadow-2xl border border-[#1F1F1F]"
                                        />
                                    </div>

                                    {/* Image controls bar */}
                                    <div className="flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-[#0A0A0A] border border-[#1F1F1F]">
                                        <button
                                            type="button"
                                            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                                            className="px-2 py-1 text-xs font-mono text-[#A0A0A0] hover:text-white transition-colors"
                                            title="Zoom Out"
                                        >
                                            -
                                        </button>
                                        <span className="text-[11px] font-mono text-white px-2">
                                            {Math.round(zoom * 100)}%
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                                            className="px-2 py-1 text-xs font-mono text-[#A0A0A0] hover:text-white transition-colors"
                                            title="Zoom In"
                                        >
                                            +
                                        </button>
                                        <div className="w-px h-3 bg-[#262626] mx-1" />
                                        <button
                                            type="button"
                                            onClick={() => setRotation((r) => (r + 90) % 360)}
                                            className="px-2 py-1 text-xs font-mono text-[#A0A0A0] hover:text-white transition-colors"
                                            title="Rotate 90°"
                                        >
                                            ↻
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setZoom(1);
                                                setRotation(0);
                                            }}
                                            className="px-2 py-1 text-[10px] font-mono text-[#737373] hover:text-white transition-colors uppercase"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* --- VIDEO PLAYER --- */}
                            {mediaType === 'video' && (
                                <div className="w-full flex flex-col items-center">
                                    <video
                                        src={mediaUrl}
                                        controls
                                        autoPlay
                                        className="w-full max-h-[60vh] rounded-lg shadow-2xl border border-[#1F1F1F] bg-black"
                                    >
                                        Your browser does not support HTML5 video playback.
                                    </video>
                                </div>
                            )}

                            {/* --- AUDIO PLAYER --- */}
                            {mediaType === 'audio' && (
                                <div className="w-full max-w-lg p-4 sm:p-6 flex flex-col items-center">
                                    <audio
                                        ref={audioRef}
                                        src={mediaUrl}
                                        loop={isLooping}
                                        onTimeUpdate={() => {
                                            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
                                        }}
                                        onLoadedMetadata={() => {
                                            if (audioRef.current) setDuration(audioRef.current.duration);
                                        }}
                                        onEnded={() => setIsPlaying(false)}
                                    />

                                    {/* Visual Disc / Glow */}
                                    <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-[#0A0A0A] border-2 border-[#1F1F1F] flex items-center justify-center shadow-2xl mb-6">
                                        <div
                                            className={`absolute inset-0 rounded-full border border-emerald-500/30 ${
                                                isPlaying ? 'animate-pulse' : ''
                                            }`}
                                        />
                                        <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center">
                                            <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Scrub Bar */}
                                    <div className="w-full mb-3">
                                        <input
                                            type="range"
                                            min={0}
                                            max={duration || 100}
                                            value={currentTime}
                                            onChange={handleSeek}
                                            className="w-full h-1.5 bg-[#141414] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                        <div className="flex justify-between text-[11px] font-mono text-[#737373] mt-1.5">
                                            <span>{formatTime(currentTime)}</span>
                                            <span>{formatTime(duration)}</span>
                                        </div>
                                    </div>

                                    {/* Audio Controls */}
                                    <div className="flex items-center justify-between w-full px-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsLooping(!isLooping)}
                                            className={`p-2 rounded-full transition-colors ${
                                                isLooping ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#737373] hover:text-white'
                                            }`}
                                            title={isLooping ? 'Looping enabled' : 'Enable loop'}
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={togglePlayAudio}
                                            className="w-12 h-12 rounded-full bg-white hover:bg-[#E5E5E5] text-black flex items-center justify-center shadow-lg transition-transform active:scale-95"
                                        >
                                            {isPlaying ? (
                                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* Volume Control */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (audioRef.current) {
                                                        audioRef.current.muted = !isMuted;
                                                        setIsMuted(!isMuted);
                                                    }
                                                }}
                                                className="text-[#737373] hover:text-white transition-colors"
                                            >
                                                {isMuted || volume === 0 ? (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                    </svg>
                                                )}
                                            </button>
                                            <input
                                                type="range"
                                                min={0}
                                                max={1}
                                                step={0.05}
                                                value={isMuted ? 0 : volume}
                                                onChange={(e) => {
                                                    const v = Number(e.target.value);
                                                    setVolume(v);
                                                    setIsMuted(false);
                                                    if (audioRef.current) {
                                                        audioRef.current.volume = v;
                                                        audioRef.current.muted = false;
                                                    }
                                                }}
                                                className="w-16 sm:w-20 h-1 bg-[#141414] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
