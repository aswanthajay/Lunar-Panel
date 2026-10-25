<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Carbon\CarbonImmutable;
use Illuminate\View\View;
use Illuminate\Http\Request;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Models\Node;
use Pterodactyl\Services\Nodes\NodeJWTService;
use Pterodactyl\Http\Controllers\Controller;

class SshTerminalController extends Controller
{
    public function __construct(
        private ViewFactory $view,
        private NodeJWTService $jwtService
    ) {
    }

    /**
     * Render the Host SSH Terminal in the Admin Panel.
     */
    public function index(Request $request): View
    {
        $user = $request->user();
        if (!$user || !$user->root_admin) {
            abort(403, 'Unauthorized. Root administrator privileges required to access the Host SSH terminal.');
        }

        $nodes = Node::all();
        $selectedNodeId = $request->query('node_id', $nodes->first()?->id);

        $node = $nodes->firstWhere('id', (int) $selectedNodeId) ?? $nodes->first();

        $wsUrl = null;
        $token = null;

        if ($node) {
            $jwt = $this->jwtService
                ->setExpiresAt(CarbonImmutable::now()->addMinutes(5))
                ->setUser($user)
                ->setClaims([
                    'user_id' => $user->id,
                    'scope' => 'admin-ssh-terminal',
                    'admin' => true,
                ])
                ->handle($node, $user->id . '-admin-ssh-' . $node->id);

            $token = $jwt->toString();
            $wsScheme = $node->scheme === 'https' ? 'wss' : 'ws';
            $wsUrl = sprintf('%s://%s:%d/api/admin/ssh/ws?token=%s', $wsScheme, $node->fqdn, $node->daemonListen, $token);
        }

        return $this->view->make('admin.ssh.index', [
            'node' => $node,
            'nodes' => $nodes,
            'wsUrl' => $wsUrl,
            'token' => $token,
        ]);
    }
}
