<?php

namespace Pterodactyl\Http\Controllers\Admin\Servers;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Spatie\QueryBuilder\QueryBuilder;
use Spatie\QueryBuilder\AllowedFilter;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Filters\AdminServerFilter;
use Illuminate\Contracts\View\Factory as ViewFactory;

class ServerController extends Controller
{
    /**
     * ServerController constructor.
     */
    public function __construct(private ViewFactory $view)
    {
    }

    /**
     * Returns all the servers that exist on the system using a paginated result set. If
     * a query is passed along in the request it is also passed to the repository function.
     */
    public function index(Request $request): View
    {
        $query = Server::query()->with('node', 'user', 'allocation');

        /** @var \Pterodactyl\Models\User $user */
        $user = $request->user();
        if ($user && !$user->root_admin) {
            $allowedServerIds = $user->getAllowedServerIds();
            if ($allowedServerIds !== null) {
                $query->whereIn('servers.id', $allowedServerIds);
            }

            $allowedNodeIds = $user->getAllowedNodeIds();
            if ($allowedNodeIds !== null) {
                $query->whereIn('servers.node_id', $allowedNodeIds);
            }

            $allowedLocationIds = $user->getAllowedLocationIds();
            if ($allowedLocationIds !== null) {
                $query->whereHas('node', function ($q) use ($allowedLocationIds) {
                    $q->whereIn('location_id', $allowedLocationIds);
                });
            }
        }

        $servers = QueryBuilder::for($query)
            ->allowedFilters([
                AllowedFilter::exact('owner_id'),
                AllowedFilter::custom('*', new AdminServerFilter()),
            ])
            ->paginate((int) config()->get('pterodactyl.paginate.admin.servers', 25));

        return $this->view->make('admin.servers.index', ['servers' => $servers]);
    }
}
