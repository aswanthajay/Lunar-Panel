import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import { Button } from '@/components/elements/button/index';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { getDiscordWebhook, saveDiscordWebhook, testDiscordWebhook } from '@/api/server/discordWebhook';
import { httpErrorToHuman } from '@/api/http';
import tw from 'twin.macro';

const EVENT_LABELS: Record<string, { label: string; desc: string }> = {
    start: { label: 'Server Start', desc: 'When the server finishes starting up' },
    stop: { label: 'Server Stop', desc: 'When the server is gracefully stopped' },
    restart: { label: 'Server Restart', desc: 'When a restart command is triggered' },
    kill: { label: 'Server Kill', desc: 'When the server is forcibly terminated' },
    crash: { label: 'Server Crash', desc: 'Instant alert when the server process crashes' },
    install: { label: 'Server Install', desc: 'When server installation or reinstallation completes' },
};

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [testing, setTesting] = useState(false);

    const [webhookUrl, setWebhookUrl] = useState('');
    const [savedUrl, setSavedUrl] = useState<string | null>(null);
    const [events, setEvents] = useState<string[]>(['start', 'stop', 'restart', 'kill', 'crash', 'install']);

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        getDiscordWebhook(uuid)
            .then((data) => {
                const url = data.webhook_url || '';
                setWebhookUrl(url);
                setSavedUrl(data.webhook_url);
                if (data.events && data.events.length > 0) {
                    setEvents(data.events);
                }
            })
            .catch((err) => {
                console.error(err);
                setMessage({ type: 'error', text: httpErrorToHuman(err) });
            })
            .finally(() => setLoading(false));
    }, [uuid]);

    const toggleEvent = (eventKey: string) => {
        if (events.includes(eventKey)) {
            setEvents(events.filter((e) => e !== eventKey));
        } else {
            setEvents([...events, eventKey]);
        }
    };

    const handleSave = () => {
        setSubmitting(true);
        setMessage(null);

        saveDiscordWebhook(uuid, webhookUrl.trim() || null, events)
            .then((res) => {
                setSavedUrl(res.webhook_url);
                setMessage({
                    type: 'success',
                    text: res.message || (res.configured ? 'Discord webhook saved successfully!' : 'Discord webhook removed.'),
                });
            })
            .catch((err) => {
                setMessage({ type: 'error', text: httpErrorToHuman(err) });
            })
            .finally(() => setSubmitting(false));
    };

    const handleTest = () => {
        const urlToTest = webhookUrl.trim() || (savedUrl ?? '');
        if (!urlToTest) {
            setMessage({ type: 'error', text: 'Please enter a Discord Webhook URL first.' });
            return;
        }

        setTesting(true);
        setMessage(null);

        testDiscordWebhook(uuid, urlToTest)
            .then((res) => {
                setMessage({ type: 'success', text: res.message || 'Test message delivered to Discord successfully!' });
            })
            .catch((err) => {
                setMessage({ type: 'error', text: httpErrorToHuman(err) });
            })
            .finally(() => setTesting(false));
    };

    const handleRemove = () => {
        setSubmitting(true);
        setMessage(null);

        saveDiscordWebhook(uuid, null)
            .then(() => {
                setWebhookUrl('');
                setSavedUrl(null);
                setMessage({ type: 'success', text: 'Discord webhook removed.' });
            })
            .catch((err) => {
                setMessage({ type: 'error', text: httpErrorToHuman(err) });
            })
            .finally(() => setSubmitting(false));
    };

    return (
        <TitledGreyBox title={'Discord Webhook Alerts'} css={tw`relative`}>
            <SpinnerOverlay visible={loading || submitting || testing} />

            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-neutral-400 m-0">
                        Receive instant, color-coded Discord alerts directly to your channel whenever your server starts, stops, or crashes.
                    </p>
                    {savedUrl ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/60 text-emerald-400 border border-emerald-700/50">
                            Active
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
                            Disabled
                        </span>
                    )}
                </div>
            </div>

            {message && (
                <div
                    className={`p-3 rounded mb-4 text-xs font-medium border ${
                        message.type === 'success'
                            ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                            : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                    }`}
                >
                    {message.text}
                </div>
            )}

            <div>
                <Label>Discord Webhook URL</Label>
                <Input
                    type={'text'}
                    placeholder={'https://discord.com/api/webhooks/123456789/...'}
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                    To create a webhook: Open Discord &gt; Channel Settings &gt; Integrations &gt; Webhooks &gt; New Webhook.
                </p>
            </div>

            <div className="mt-4">
                <Label>Alert Events</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {Object.entries(EVENT_LABELS).map(([key, info]) => {
                        const isChecked = events.includes(key);
                        return (
                            <label
                                key={key}
                                className={`flex items-start space-x-2.5 p-2 rounded border cursor-pointer transition-colors ${
                                    isChecked
                                        ? 'bg-neutral-800/80 border-cyan-500/40 text-neutral-200'
                                        : 'bg-neutral-900/40 border-neutral-800 text-neutral-400'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-0 focus:ring-offset-0"
                                    checked={isChecked}
                                    onChange={() => toggleEvent(key)}
                                />
                                <div className="text-xs">
                                    <div className="font-semibold text-neutral-200">{info.label}</div>
                                    <div className="text-[10px] text-neutral-500 leading-tight">{info.desc}</div>
                                </div>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                <div>
                    {savedUrl && (
                        <Button.Danger
                            variant={Button.Variants.Secondary}
                            onClick={handleRemove}
                            type={'button'}
                            css={tw`text-xs`}
                        >
                            Disable
                        </Button.Danger>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    <Button.Text
                        variant={Button.Variants.Secondary}
                        onClick={handleTest}
                        type={'button'}
                        disabled={!webhookUrl.trim()}
                        css={tw`text-xs`}
                    >
                        Send Test Alert
                    </Button.Text>
                    <Button onClick={handleSave} type={'button'} css={tw`text-xs`}>
                        Save Webhook
                    </Button>
                </div>
            </div>
        </TitledGreyBox>
    );
};
