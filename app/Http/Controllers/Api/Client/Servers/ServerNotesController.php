<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ServerNotesController extends ClientApiController
{
    /**
     * Get server notes and admin scratchpad.
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        $server->loadMissing(['notesAuthor']);

        $isAdmin = (bool) $request->user()->root_admin;
        if ($isAdmin) {
            $server->loadMissing(['adminNotesAuthor']);
        }

        $response = [
            'notes' => $server->notes ?? '',
            'updated_at' => $server->notes_updated_at ? $server->notes_updated_at->toIso8601String() : null,
            'updated_by' => $server->notesAuthor ? [
                'id' => $server->notesAuthor->id,
                'username' => $server->notesAuthor->username,
                'name' => trim($server->notesAuthor->name_first . ' ' . $server->notesAuthor->name_last) ?: $server->notesAuthor->username,
            ] : null,
            'can_edit' => true,
            'is_admin' => $isAdmin,
        ];

        if ($isAdmin) {
            $response['admin_notes'] = $server->admin_notes ?? '';
            $response['admin_updated_at'] = $server->admin_notes_updated_at ? $server->admin_notes_updated_at->toIso8601String() : null;
            $response['admin_updated_by'] = $server->adminNotesAuthor ? [
                'id' => $server->adminNotesAuthor->id,
                'username' => $server->adminNotesAuthor->username,
                'name' => trim($server->adminNotesAuthor->name_first . ' ' . $server->adminNotesAuthor->name_last) ?: $server->adminNotesAuthor->username,
            ] : null;
        }

        return new JsonResponse($response);
    }

    /**
     * Update the shared server notes.
     */
    public function updateNotes(Request $request, Server $server): JsonResponse
    {
        $this->validate($request, [
            'notes' => 'nullable|string',
        ]);

        $server->notes = $request->input('notes');
        $server->notes_updated_by = $request->user()->id;
        $server->notes_updated_at = now();
        $server->save();

        Activity::event('server:notes.update')
            ->subject($server)
            ->property('length', strlen($server->notes ?? ''))
            ->log();

        $server->load('notesAuthor');

        return new JsonResponse([
            'success' => true,
            'message' => 'Server notes saved successfully.',
            'notes' => $server->notes ?? '',
            'updated_at' => $server->notes_updated_at ? $server->notes_updated_at->toIso8601String() : null,
            'updated_by' => [
                'id' => $request->user()->id,
                'username' => $request->user()->username,
                'name' => trim($request->user()->name_first . ' ' . $request->user()->name_last) ?: $request->user()->username,
            ],
        ]);
    }

    /**
     * Update the private admin scratchpad.
     */
    public function updateAdminNotes(Request $request, Server $server): JsonResponse
    {
        if (!$request->user()->root_admin) {
            throw new AccessDeniedHttpException('Only panel administrators can access the admin scratchpad.');
        }

        $this->validate($request, [
            'admin_notes' => 'nullable|string',
        ]);

        $server->admin_notes = $request->input('admin_notes');
        $server->admin_notes_updated_by = $request->user()->id;
        $server->admin_notes_updated_at = now();
        $server->save();

        Activity::event('server:admin-notes.update')
            ->subject($server)
            ->property('length', strlen($server->admin_notes ?? ''))
            ->log();

        return new JsonResponse([
            'success' => true,
            'message' => 'Admin scratchpad saved successfully.',
            'admin_notes' => $server->admin_notes ?? '',
            'admin_updated_at' => $server->admin_notes_updated_at ? $server->admin_notes_updated_at->toIso8601String() : null,
            'admin_updated_by' => [
                'id' => $request->user()->id,
                'username' => $request->user()->username,
                'name' => trim($request->user()->name_first . ' ' . $request->user()->name_last) ?: $request->user()->username,
            ],
        ]);
    }
}
