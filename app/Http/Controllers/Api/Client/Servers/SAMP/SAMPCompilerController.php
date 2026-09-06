<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers\SAMP;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Pterodactyl\Services\Pawn\PawnCompilerService;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Illuminate\Auth\Access\AuthorizationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class SAMPCompilerController extends ClientApiController
{
    public function __construct(
        private DaemonFileRepository $fileRepository,
        private PawnCompilerService $compilerService
    ) {
        parent::__construct();
    }

    /**
     * List all .pwn files found in the server (gamemodes, filterscripts, root).
     */
    public function index(Request $request, Server $server): JsonResponse
    {
        if (!$server->isSamp()) {
            throw new AccessDeniedHttpException('This feature is only available for SA-MP / open.mp servers.');
        }

        $repo = $this->fileRepository->setServer($server);
        $discovered = [];

        // Scan primary SA-MP script folders
        $scanDirs = [
            'gamemodes' => 'gamemode',
            'filterscripts' => 'filterscript',
            '' => 'root',
        ];

        foreach ($scanDirs as $dir => $type) {
            try {
                $items = $repo->getDirectory($dir ? "/{$dir}" : '/');
                if (!is_array($items)) continue;

                // Collect .amx file names in this directory to check if already compiled
                $amxNames = [];
                foreach ($items as $it) {
                    $name = $it['name'] ?? '';
                    if (str_ends_with(strtolower($name), '.amx')) {
                        $amxNames[strtolower(substr($name, 0, -4))] = $it;
                    }
                }

                foreach ($items as $it) {
                    $name = $it['name'] ?? '';
                    if (!str_ends_with(strtolower($name), '.pwn')) continue;

                    $base = substr($name, 0, -4);
                    $relPath = $dir ? "{$dir}/{$name}" : $name;
                    $hasAmx = isset($amxNames[strtolower($base)]);

                    $discovered[] = [
                        'name' => $name,
                        'path' => $relPath,
                        'type' => $type,
                        'size' => $it['size'] ?? 0,
                        'modified' => $it['modified_at'] ?? null,
                        'has_amx' => $hasAmx,
                        'amx_path' => $dir ? "{$dir}/{$base}.amx" : "{$base}.amx",
                        'amx_size' => $hasAmx ? ($amxNames[strtolower($base)]['size'] ?? 0) : 0,
                    ];
                }
            } catch (\Throwable) {}
        }

        return response()->json([
            'files' => $discovered,
            'compiler_ready' => true,
            'platform' => strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'windows' : 'linux',
        ]);
    }

    /**
     * Get content of a .pwn source file.
     */
    public function file(Request $request, Server $server): JsonResponse
    {
        if (!$server->isSamp()) {
            throw new AccessDeniedHttpException('This feature is only available for SA-MP / open.mp servers.');
        }

        $path = $this->sanitizePath((string) $request->query('path'));
        if (!str_ends_with(strtolower($path), '.pwn')) {
            return response()->json(['error' => 'Only .pwn files can be opened in the Pawn Compiler.'], 400);
        }

        $repo = $this->fileRepository->setServer($server);

        try {
            $content = $repo->getContent("/{$path}");
            return response()->json([
                'path' => $path,
                'content' => $content,
                'size' => strlen($content),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to load file: ' . $e->getMessage()], 404);
        }
    }

    /**
     * Save updated content to a .pwn source file.
     */
    public function save(Request $request, Server $server): JsonResponse
    {
        if (!$server->isSamp()) {
            throw new AccessDeniedHttpException('This feature is only available for SA-MP / open.mp servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_UPDATE, $server) &&
            !$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $path = $this->sanitizePath((string) $request->input('path'));
        $content = (string) $request->input('content', '');

        if (!str_ends_with(strtolower($path), '.pwn')) {
            return response()->json(['error' => 'Only .pwn files can be saved.'], 400);
        }

        $repo = $this->fileRepository->setServer($server);

        try {
            $repo->putContent("/{$path}", $content);
            return response()->json([
                'success' => true,
                'path' => $path,
                'size' => strlen($content),
                'saved_at' => now()->toIso8601String(),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to save file: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Compile a .pwn file into an .amx binary.
     */
    public function compile(Request $request, Server $server): JsonResponse
    {
        if (!$server->isSamp()) {
            throw new AccessDeniedHttpException('This feature is only available for SA-MP / open.mp servers.');
        }

        if (!$request->user()->can(Permission::ACTION_CONTROL_CONSOLE, $server)) {
            throw new AuthorizationException();
        }

        $target = $this->sanitizePath((string) $request->input('target'));
        $content = $request->input('content'); // optional updated code to compile immediately

        if (!str_ends_with(strtolower($target), '.pwn')) {
            return response()->json(['error' => 'Target must be a .pwn source file.'], 400);
        }

        try {
            $result = $this->compilerService->compile($server, $target, is_string($content) ? $content : null);
            return response()->json($result);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'logs' => 'Compilation error: ' . $e->getMessage(),
                'amx_path' => preg_replace('/\.pwn$/i', '.amx', $target),
                'amx_size' => 0,
                'errors_count' => 1,
                'warnings_count' => 0,
            ], 422);
        }
    }

    private function sanitizePath(string $path): string
    {
        $clean = str_replace('\\', '/', $path);
        $clean = preg_replace('#/\./#', '/', $clean);
        $clean = preg_replace('#/+#', '/', $clean);
        $clean = trim($clean, '/');

        // Prevent directory traversal
        $parts = [];
        foreach (explode('/', $clean) as $segment) {
            if ($segment === '..') {
                array_pop($parts);
            } elseif ($segment !== '.' && $segment !== '') {
                $parts[] = $segment;
            }
        }

        return implode('/', $parts);
    }
}
