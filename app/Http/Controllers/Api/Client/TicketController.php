<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Pterodactyl\Models\Ticket;
use Pterodactyl\Models\TicketMessage;
use Pterodactyl\Models\Server;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;

class TicketController extends ClientApiController
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isAdminQuery = $request->input('admin') === 'true' && $user->root_admin;

        $query = Ticket::query()->with(['user:id,username,email', 'server:id,name,uuid,uuidShort', 'messages' => function ($q) {
            $q->latest()->limit(1);
        }]);

        if (!$isAdminQuery) {
            $query->where('user_id', $user->id);
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('department') && $request->input('department') !== 'all') {
            $query->where('department', $request->input('department'));
        }

        if ($request->filled('priority') && $request->input('priority') !== 'all') {
            $query->where('priority', $request->input('priority'));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', $search)
                  ->orWhere('ticket_id', 'like', $search);
            });
        }

        $tickets = $query->orderBy('updated_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $tickets,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|min:3|max:191',
            'department' => 'required|string',
            'priority' => 'required|in:low,medium,high,critical',
            'message' => 'required|string|min:3',
            'server_id' => 'nullable|integer',
            'attachment' => 'nullable|file|max:5120', // max 5MB
        ]);

        $user = $request->user();

        $latest = Ticket::max('id') ?? 1040;
        $ticketId = 'T-' . ($latest + 1);

        $ticket = Ticket::create([
            'ticket_id' => $ticketId,
            'user_id' => $user->id,
            'server_id' => $request->input('server_id'),
            'title' => $request->input('title'),
            'department' => $request->input('department'),
            'priority' => $request->input('priority'),
            'status' => 'open',
        ]);

        // Process optional attachment
        $attachmentData = $this->handleUploadedFile($request);

        TicketMessage::create(array_merge([
            'ticket_id' => $ticket->id,
            'user_id' => $user->id,
            'is_staff' => false,
            'message' => $request->input('message'),
        ], $attachmentData));

        $ticket->load(['user:id,username,email', 'server:id,name,uuid,uuidShort', 'messages.user:id,username,email']);

        // Dispatch Web Push notification to admins
        try {
            app(\Pterodactyl\Services\Notifications\WebPushNotificationService::class)->sendToAllAdmins(
                "New Support Ticket #{$ticket->ticket_id}",
                "{$user->username}: {$ticket->title} ({$ticket->department})",
                "/support/{$ticket->id}",
                null,
                'admin_new_ticket'
            );
        } catch (\Throwable) {}

        return response()->json([
            'success' => true,
            'data' => $ticket,
        ], 201);
    }

    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $ticket = Ticket::with(['user:id,username,email', 'server:id,name,uuid,uuidShort', 'messages.user:id,username,email'])->findOrFail($id);

        if ($ticket->user_id !== $user->id && !$user->root_admin) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $ticket,
        ]);
    }

    public function reply(Request $request, $id): JsonResponse
    {
        $request->validate([
            'message' => 'required|string|min:1',
            'is_staff' => 'nullable',
            'attachment' => 'nullable|file|max:5120', // max 5MB
        ]);

        $user = $request->user();
        $ticket = Ticket::findOrFail($id);

        if ($ticket->user_id !== $user->id && !$user->root_admin) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $isStaff = ($request->input('is_staff') == 'true' || $request->input('is_staff') === true || $request->input('is_staff') == 1) && $user->root_admin;

        // Process optional attachment
        $attachmentData = $this->handleUploadedFile($request);

        $msg = TicketMessage::create(array_merge([
            'ticket_id' => $ticket->id,
            'user_id' => $user->id,
            'is_staff' => $isStaff,
            'message' => $request->input('message'),
        ], $attachmentData));

        if ($isStaff) {
            $ticket->status = 'answered';
        } else {
            if ($ticket->status === 'closed' || $ticket->status === 'answered') {
                $ticket->status = 'open';
            }
        }
        $ticket->touch();
        $ticket->save();

        // Dispatch Web Push notification
        try {
            $pushService = app(\Pterodactyl\Services\Notifications\WebPushNotificationService::class);
            if ($isStaff) {
                if ($ticket->user) {
                    $pushService->sendToUser(
                        $ticket->user,
                        "Ticket Update #{$ticket->ticket_id}",
                        "Staff replied: " . \Illuminate\Support\Str::limit($request->input('message'), 80),
                        "/support/{$ticket->id}",
                        null,
                        'ticket_reply'
                    );
                }
            } else {
                $pushService->sendToAllAdmins(
                    "Ticket Reply #{$ticket->ticket_id}",
                    "{$user->username}: " . \Illuminate\Support\Str::limit($request->input('message'), 80),
                    "/support/{$ticket->id}",
                    null,
                    'admin_new_ticket'
                );
            }
        } catch (\Throwable) {}

        $msg->load('user:id,username,email');

        return response()->json([
            'success' => true,
            'data' => $msg,
            'ticket' => $ticket->fresh(['user:id,username,email', 'server:id,name,uuid,uuidShort']),
        ]);
    }

    public function updateStatus(Request $request, $id): JsonResponse
    {
        $request->validate([
            'status' => 'nullable|in:open,in_progress,answered,closed',
            'priority' => 'nullable|in:low,medium,high,critical',
        ]);

        $user = $request->user();
        $ticket = Ticket::findOrFail($id);

        if ($ticket->user_id !== $user->id && !$user->root_admin) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($request->filled('status')) {
            $ticket->status = $request->input('status');
        }

        if ($request->filled('priority') && $user->root_admin) {
            $ticket->priority = $request->input('priority');
        }

        $ticket->save();

        return response()->json([
            'success' => true,
            'data' => $ticket->fresh(['user:id,username,email', 'server:id,name,uuid,uuidShort']),
        ]);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $ticket = Ticket::findOrFail($id);

        if (!$user->root_admin && $ticket->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Clean up any uploaded attachment files
        foreach ($ticket->messages as $msg) {
            if ($msg->attachment_path) {
                $realPath = public_path(ltrim($msg->attachment_path, '/'));
                if (file_exists($realPath)) {
                    @unlink($realPath);
                }
            }
        }

        $ticket->delete();

        return response()->json([
            'success' => true,
            'message' => 'Ticket deleted successfully',
        ]);
    }

    protected function handleUploadedFile(Request $request): array
    {
        if (!$request->hasFile('attachment')) {
            return [];
        }

        $file = $request->file('attachment');
        if (!$file->isValid()) {
            return [];
        }

        $mime = $file->getMimeType();
        $ext = strtolower($file->getClientOriginalExtension() ?: 'bin');
        $isImage = str_starts_with($mime, 'image/') || in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);
        $isText = str_starts_with($mime, 'text/') || in_array($ext, ['log', 'txt', 'json', 'yml', 'yaml', 'cfg', 'conf', 'md', 'ini', 'xml', 'properties']);
        $type = $isImage ? 'image' : ($isText ? 'text' : 'file');

        $filename = 'att_' . time() . '_' . Str::random(8) . '.' . $ext;
        $targetDir = public_path('uploads/tickets');
        if (!file_exists($targetDir)) {
            mkdir($targetDir, 0755, true);
        }

        $file->move($targetDir, $filename);

        return [
            'attachment_path' => '/uploads/tickets/' . $filename,
            'attachment_name' => $file->getClientOriginalName(),
            'attachment_type' => $type,
            'attachment_size' => $file->getSize(),
        ];
    }
}
