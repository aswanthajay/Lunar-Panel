<?php

namespace Pterodactyl\Notifications;

use Pterodactyl\Models\User;
use Illuminate\Bus\Queueable;
use Pterodactyl\Models\Server;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

class ServerExpiringSoon extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Server $server,
        public int $daysRemaining
    ) {}

    /**
     * Get the notification's delivery channels.
     */
    public function via(): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(User $notifiable): MailMessage
    {
        $daysText = match ($this->daysRemaining) {
            1 => '24 hours',
            3 => '3 days',
            7 => '7 days',
            default => "{$this->daysRemaining} days",
        };

        $expiryDate = $this->server->expires_at
            ? $this->server->expires_at->format('M j, Y')
            : 'soon';

        $amount = (int) ($this->server->billing_amount ?: 499);
        $panelUrl = config('app.url', 'https://terminal.lunarcloud.in');
        $billingUrl = rtrim($panelUrl, '/') . '/billing';

        return (new MailMessage())
            ->subject("[Action Required] Server '{$this->server->name}' expires in {$daysText}")
            ->greeting("Hello {$notifiable->username},")
            ->line("Your game server instance **{$this->server->name}** is scheduled to expire in **{$daysText}** (on {$expiryDate}).")
            ->line("To keep your instance online without downtime or automated suspension, please renew your subscription.")
            ->line("**Server Details:**")
            ->line("- **Server Name:** {$this->server->name} (`{$this->server->uuidShort}`)")
            ->line("- **Expiration Date:** {$expiryDate}")
            ->line("- **Renewal Fee:** ₹{$amount}")
            ->action('Renew Server Now', $billingUrl)
            ->line('All files, configurations, and world data are safely preserved. If you have already submitted a renewal payment, our operations team will approve it shortly.');
    }
}
