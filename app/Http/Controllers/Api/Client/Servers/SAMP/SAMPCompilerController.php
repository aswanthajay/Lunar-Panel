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

        // Ensure gamemodes directory exists on server (required for SA-MP servers)
        $hasGamemodesDir = false;
        try {
            $repo->getDirectory('/gamemodes');
            $hasGamemodesDir = true;
        } catch (\Throwable) {
            try {
                $repo->createDirectory('gamemodes', '/');
                $hasGamemodesDir = true;
            } catch (\Throwable) {}
        }

        // Check if server has its own /pawno/include
        $hasPawnoInclude = false;
        try {
            $pawnoList = $repo->getDirectory('/pawno/include');
            $hasPawnoInclude = is_array($pawnoList) && count($pawnoList) > 0;
        } catch (\Throwable) {
            try {
                $pawnoList = $repo->getDirectory('/include');
                $hasPawnoInclude = is_array($pawnoList) && count($pawnoList) > 0;
            } catch (\Throwable) {}
        }

        // Scan primary SA-MP script folders
        $discovered = [];
        $discovered = array_merge($discovered, $this->scanForPwnFiles($repo, 'gamemodes', 'gamemode'));
        $discovered = array_merge($discovered, $this->scanForPwnFiles($repo, 'filterscripts', 'filterscript'));
        $discovered = array_merge($discovered, $this->scanForPwnFiles($repo, '', 'root'));

        return response()->json([
            'files' => $discovered,
            'gamemodes_ready' => $hasGamemodesDir,
            'has_pawno_include' => $hasPawnoInclude,
            'compiler_ready' => true,
            'platform' => strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'windows' : 'linux',
        ]);
    }

    /**
     * Recursively scan a folder for .pwn files and their matching .amx binaries.
     */
    private function scanForPwnFiles(DaemonFileRepository $repo, string $dir, string $type, int $depth = 0): array
    {
        if ($depth > 2) return [];
        $files = [];

        try {
            $path = $dir ? "/{$dir}" : '/';
            $items = $repo->getDirectory($path);
            if (!is_array($items)) return [];

            $amxNames = [];
            foreach ($items as $it) {
                $name = $it['name'] ?? '';
                if (str_ends_with(strtolower($name), '.amx')) {
                    $amxNames[strtolower(substr($name, 0, -4))] = $it;
                }
            }

            foreach ($items as $it) {
                $name = $it['name'] ?? '';
                if (!$name || $name === '.' || $name === '..') continue;

                $relPath = $dir ? "{$dir}/{$name}" : $name;
                $isFile = $it['is_file'] ?? true;

                if ($isFile) {
                    if (str_ends_with(strtolower($name), '.pwn')) {
                        $base = substr($name, 0, -4);
                        $hasAmx = isset($amxNames[strtolower($base)]);

                        $files[] = [
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
                } elseif (!($it['is_symlink'] ?? false) && $depth < 2) {
                    // Subdirectory inside gamemodes or filterscripts
                    $subFiles = $this->scanForPwnFiles($repo, $relPath, $type, $depth + 1);
                    $files = array_merge($files, $subFiles);
                }
            }
        } catch (\Throwable) {}

        return $files;
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
            $raw = $repo->getContent("/{$path}");
            $content = PawnCompilerService::ensureUtf8($raw);
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
     * Create a new .pwn script (defaults to gamemodes/ folder).
     */
    public function create(Request $request, Server $server): JsonResponse
    {
        if (!$server->isSamp()) {
            throw new AccessDeniedHttpException('This feature is only available for SA-MP / open.mp servers.');
        }

        if (!$request->user()->can(Permission::ACTION_FILE_CREATE, $server)) {
            throw new AuthorizationException();
        }

        $name = trim((string) $request->input('name', 'new_gamemode'));
        $name = preg_replace('#[^a-zA-Z0-9_\-\.]#', '', $name);
        if (!str_ends_with(strtolower($name), '.pwn')) {
            $name .= '.pwn';
        }

        $folder = trim((string) $request->input('folder', 'gamemodes'), '/');
        if (!in_array($folder, ['gamemodes', 'filterscripts', ''])) {
            $folder = 'gamemodes';
        }

        $repo = $this->fileRepository->setServer($server);

        // Ensure directory exists on the server
        if ($folder) {
            try {
                $repo->getDirectory("/{$folder}");
            } catch (\Throwable) {
                try {
                    $repo->createDirectory($folder, '/');
                } catch (\Throwable) {}
            }
        }

        $targetPath = $folder ? "{$folder}/{$name}" : $name;

        $template = "#include <a_samp>\n\nmain()\n{\n    print(\"\\n----------------------------------\");\n    print(\" Running SA-MP Server Gamemode\");\n    print(\"----------------------------------\\n\");\n}\n\npublic OnGameModeInit()\n{\n    SetGameModeText(\"Blank Gamemode\");\n    AddPlayerClass(0, 1958.3783, 1343.1572, 15.3746, 269.1425, 0, 0, 0, 0, 0, 0);\n    return 1;\n}\n\npublic OnGameModeExit()\n{\n    return 1;\n}\n\npublic OnPlayerRequestClass(playerid, classid)\n{\n    SetPlayerPos(playerid, 1958.3783, 1343.1572, 15.3746);\n    SetPlayerCameraPos(playerid, 1958.3783, 1347.1572, 15.3746);\n    SetPlayerCameraLookAt(playerid, 1958.3783, 1343.1572, 15.3746);\n    return 1;\n}\n";

        try {
            $repo->putContent("/{$targetPath}", $template);
            return response()->json([
                'success' => true,
                'path' => $targetPath,
                'name' => $name,
                'content' => $template,
                'size' => strlen($template),
                'message' => "Created {$targetPath} successfully in gamemodes.",
            ]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to create script: ' . $e->getMessage()], 500);
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

        $repo = $this->fileRepository->setServer($server);

        // If target was given without folder, check if it's in gamemodes/
        if (!str_contains($target, '/')) {
            try {
                $repo->getContent("/gamemodes/{$target}");
                $target = "gamemodes/{$target}";
            } catch (\Throwable) {}
        }

        try {
            $result = $this->compilerService->compile($server, $target, is_string($content) ? $content : null);
            if (isset($result['logs'])) {
                $result['logs'] = PawnCompilerService::ensureUtf8((string) $result['logs']);
            }
            return response()->json($result);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'logs' => PawnCompilerService::ensureUtf8('Compilation error: ' . $e->getMessage()),
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
