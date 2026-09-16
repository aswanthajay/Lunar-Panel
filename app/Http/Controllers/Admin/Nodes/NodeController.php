<?php

namespace Pterodactyl\Http\Controllers\Admin\Nodes;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Pterodactyl\Models\Node;
use Spatie\QueryBuilder\QueryBuilder;
use Pterodactyl\Http\Controllers\Controller;
use Illuminate\Contracts\View\Factory as ViewFactory;

class NodeController extends Controller
{
    /**
     * NodeController constructor.
     */
    public function __construct(private ViewFactory $view)
    {
    }

    /**
     * Returns a listing of nodes on the system.
     */
    public function index(Request $request): View
    {
        $query = Node::query()->with('location')->withCount('servers');

        /** @var \Pterodactyl\Models\User $user */
        $user = $request->user();
        if ($user && !$user->root_admin) {
            $allowedNodeIds = $user->getAllowedNodeIds();
            if ($allowedNodeIds !== null) {
                $query->whereIn('nodes.id', $allowedNodeIds);
            }

            $allowedLocationIds = $user->getAllowedLocationIds();
            if ($allowedLocationIds !== null) {
                $query->whereIn('nodes.location_id', $allowedLocationIds);
            }
        }

        $nodes = QueryBuilder::for($query)
            ->allowedFilters(['uuid', 'name'])
            ->allowedSorts(['id'])
            ->paginate(25);

        return $this->view->make('admin.nodes.index', ['nodes' => $nodes]);
    }
}
