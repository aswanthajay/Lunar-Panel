<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Pterodactyl\Models\User;
use Pterodactyl\Models\Model;
use Illuminate\Support\Collection;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Spatie\QueryBuilder\QueryBuilder;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Http\Controllers\Controller;
use Illuminate\Contracts\Translation\Translator;
use Pterodactyl\Services\Users\UserUpdateService;
use Pterodactyl\Traits\Helpers\AvailableLanguages;
use Pterodactyl\Services\Users\UserCreationService;
use Pterodactyl\Services\Users\UserDeletionService;
use Pterodactyl\Http\Requests\Admin\UserFormRequest;
use Pterodactyl\Http\Requests\Admin\NewUserFormRequest;
use Pterodactyl\Contracts\Repository\UserRepositoryInterface;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\AdminRole;
use Pterodactyl\Models\AdminStaff;

class UserController extends Controller
{
    use AvailableLanguages;

    /**
     * UserController constructor.
     */
    public function __construct(
        protected AlertsMessageBag $alert,
        protected UserCreationService $creationService,
        protected UserDeletionService $deletionService,
        protected Translator $translator,
        protected UserUpdateService $updateService,
        protected UserRepositoryInterface $repository,
        protected ViewFactory $view
    ) {
    }

    /**
     * Display user index page.
     */
    public function index(Request $request): View
    {
        $users = QueryBuilder::for(
            User::query()->select('users.*')
                ->selectRaw('COUNT(DISTINCT(subusers.id)) as subuser_of_count')
                ->selectRaw('COUNT(DISTINCT(servers.id)) as servers_count')
                ->leftJoin('subusers', 'subusers.user_id', '=', 'users.id')
                ->leftJoin('servers', 'servers.owner_id', '=', 'users.id')
                ->groupBy('users.id')
        )
            ->allowedFilters(['username', 'email', 'uuid'])
            ->allowedSorts(['id', 'uuid'])
            ->paginate(50);

        return $this->view->make('admin.users.index', ['users' => $users]);
    }

    /**
     * Display new user page.
     */
    public function create(): View
    {
        return $this->view->make('admin.users.new', [
            'languages' => $this->getAvailableLanguages(true),
        ]);
    }

    /**
     * Display user view page.
     */
    public function view(User $user): View
    {
        $user->load('staff.role');
        $roles = AdminRole::orderBy('name')->get();
        $nodes = Node::orderBy('name')->get();
        $locations = Location::orderBy('short')->get();

        return $this->view->make('admin.users.view', [
            'user' => $user,
            'languages' => $this->getAvailableLanguages(true),
            'roles' => $roles,
            'nodes' => $nodes,
            'locations' => $locations,
            'staff' => $user->staff,
        ]);
    }

    /**
     * Delete a user from the system.
     *
     * @throws \Exception
     * @throws \Pterodactyl\Exceptions\DisplayException
     */
    public function delete(Request $request, User $user): RedirectResponse
    {
        if ($request->user()->id === $user->id) {
            throw new DisplayException($this->translator->get('admin/user.exceptions.user_has_servers'));
        }

        $this->deletionService->handle($user);

        return redirect()->route('admin.users');
    }

    /**
     * Create a user.
     *
     * @throws \Exception
     * @throws \Throwable
     */
    public function store(NewUserFormRequest $request): RedirectResponse
    {
        $user = $this->creationService->handle($request->normalize());
        $this->alert->success($this->translator->get('admin/user.notices.account_created'))->flash();

        return redirect()->route('admin.users.view', $user->id);
    }

    /**
     * Update a user on the system.
     *
     * @throws \Pterodactyl\Exceptions\Model\DataValidationException
     * @throws \Pterodactyl\Exceptions\Repository\RecordNotFoundException
     */
    public function update(UserFormRequest $request, User $user): RedirectResponse
    {
        $this->updateService
            ->setUserLevel(User::USER_LEVEL_ADMIN)
            ->handle($user, $request->normalize());

        // Handle staff role and scoping assignment if caller is authorized
        $caller = $request->user();
        if ($caller && ($caller->root_admin || $caller->hasAdminPermission('roles.manage'))) {
            $isRootAdmin = (bool) $request->input('root_admin', 0);
            $staffRoleId = $request->input('staff_role_id');

            if ($isRootAdmin) {
                // Root admin doesn't need scoped staff entry
                AdminStaff::where('user_id', $user->id)->delete();
            } else {
                if (!empty($staffRoleId)) {
                    $scopeNodes = $request->input('staff_scope_nodes');
                    if (empty($scopeNodes) || in_array('all', (array) $scopeNodes)) {
                        $scopeNodes = null;
                    } else {
                        $scopeNodes = array_map('intval', (array) $scopeNodes);
                    }

                    $scopeLocations = $request->input('staff_scope_locations');
                    if (empty($scopeLocations) || in_array('all', (array) $scopeLocations)) {
                        $scopeLocations = null;
                    } else {
                        $scopeLocations = array_map('intval', (array) $scopeLocations);
                    }

                    $serverInput = $request->input('staff_scope_servers');
                    $scopeServers = null;
                    if (!empty($serverInput)) {
                        if (is_string($serverInput)) {
                            $parts = array_filter(array_map('trim', explode(',', $serverInput)));
                            $scopeServers = !empty($parts) ? array_map('intval', $parts) : null;
                        } elseif (is_array($serverInput)) {
                            $scopeServers = array_map('intval', $serverInput);
                        }
                    }

                    AdminStaff::updateOrCreate(
                        ['user_id' => $user->id],
                        [
                            'role_id' => (int) $staffRoleId,
                            'scope_nodes' => $scopeNodes,
                            'scope_locations' => $scopeLocations,
                            'scope_servers' => $scopeServers,
                            'is_active' => (bool) $request->input('staff_is_active', 1),
                        ]
                    );
                } else {
                    // No staff role selected, remove staff privileges if not root admin
                    AdminStaff::where('user_id', $user->id)->delete();
                }
            }
        }

        $this->alert->success(trans('admin/user.notices.account_updated'))->flash();

        return redirect()->route('admin.users.view', $user->id);
    }

    /**
     * Get a JSON response of users on the system.
     */
    public function json(Request $request): Model|Collection
    {
        $users = QueryBuilder::for(User::query())->allowedFilters(['email'])->paginate(25);

        // Handle single user requests.
        if ($request->query('user_id')) {
            $user = User::query()->findOrFail($request->input('user_id'));
            $user->md5 = md5(strtolower($user->email));

            return $user;
        }

        return $users->map(function ($item) {
            $item->md5 = md5(strtolower($item->email));

            return $item;
        });
    }
}
