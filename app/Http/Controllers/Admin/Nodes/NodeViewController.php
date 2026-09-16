<?php

namespace Pterodactyl\Http\Controllers\Admin\Nodes;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Pterodactyl\Models\Node;
use Illuminate\Support\Collection;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Http\Controllers\Controller;
use Illuminate\Contracts\View\Factory as ViewFactory;
use Pterodactyl\Repositories\Eloquent\NodeRepository;
use Pterodactyl\Repositories\Eloquent\ServerRepository;
use Pterodactyl\Traits\Controllers\JavascriptInjection;
use Pterodactyl\Services\Helpers\SoftwareVersionService;
use Pterodactyl\Repositories\Eloquent\LocationRepository;
use Pterodactyl\Repositories\Eloquent\AllocationRepository;

class NodeViewController extends Controller
{
    use JavascriptInjection;

    /**
     * NodeViewController constructor.
     */
    public function __construct(
        private AllocationRepository $allocationRepository,
        private LocationRepository $locationRepository,
        private NodeRepository $repository,
        private ServerRepository $serverRepository,
        private SoftwareVersionService $versionService,
        private ViewFactory $view
    ) {
    }

    /**
     * Helper to verify if the requesting staff user can access this specific node.
     */
    protected function authorizeNodeAccess(Request $request, Node $node, string $permission = 'nodes.view'): void
    {
        /** @var \Pterodactyl\Models\User $user */
        $user = $request->user();
        if ($user && $user->root_admin) {
            return;
        }

        if (!$user || !$user->canAccessNode($node) || !$user->hasAdminPermission($permission)) {
            abort(403, 'You do not have administrative permission to view or manage this node.');
        }
    }

    /**
     * Returns index view for a specific node on the system.
     */
    public function index(Request $request, Node $node): View
    {
        $this->authorizeNodeAccess($request, $node, 'nodes.view');

        $node = $this->repository->loadLocationAndServerCount($node);

        return $this->view->make('admin.nodes.view.index', [
            'node' => $node,
            'stats' => $this->repository->getUsageStats($node),
            'version' => $this->versionService,
        ]);
    }

    /**
     * Returns the settings page for a specific node.
     */
    public function settings(Request $request, Node $node): View
    {
        $this->authorizeNodeAccess($request, $node, 'nodes.edit');

        return $this->view->make('admin.nodes.view.settings', [
            'node' => $node,
            'locations' => $this->locationRepository->all(),
        ]);
    }

    /**
     * Return the node configuration page for a specific node.
     */
    public function configuration(Request $request, Node $node): View
    {
        $this->authorizeNodeAccess($request, $node, 'nodes.view_config');

        return $this->view->make('admin.nodes.view.configuration', compact('node'));
    }

    /**
     * Return the node allocation management page.
     */
    public function allocations(Request $request, Node $node): View
    {
        $this->authorizeNodeAccess($request, $node, 'nodes.allocations');

        $node = $this->repository->loadNodeAllocations($node);

        $this->plainInject(['node' => Collection::wrap($node)->only(['id'])]);

        return $this->view->make('admin.nodes.view.allocation', [
            'node' => $node,
            'allocations' => Allocation::query()->where('node_id', $node->id)
                ->groupBy('ip')
                ->orderByRaw('INET_ATON(ip) ASC')
                ->get(['ip']),
        ]);
    }

    /**
     * Return a listing of servers that exist for this specific node.
     */
    public function servers(Request $request, Node $node): View
    {
        $this->authorizeNodeAccess($request, $node, 'nodes.view');

        $this->plainInject([
            'node' => Collection::wrap($node->makeVisible(['daemon_token_id', 'daemon_token']))
                ->only(['scheme', 'fqdn', 'daemonListen', 'daemon_token_id', 'daemon_token']),
        ]);

        return $this->view->make('admin.nodes.view.servers', [
            'node' => $node,
            'servers' => $this->serverRepository->loadAllServersForNode($node->id, 25),
        ]);
    }
}
