<?php

namespace Pterodactyl\Http\Controllers\Base;

use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Contracts\Repository\ServerRepositoryInterface;

class IndexController extends Controller
{
    /**
     * IndexController constructor.
     */
    public function __construct(
        protected ServerRepositoryInterface $repository,
        protected ViewFactory $view
    ) {
    }

    /**
     * Returns listing of user's servers or redirects unauthenticated guests to login.
     */
    public function index(): mixed
    {
        if (!Auth::check()) {
            return redirect()->guest(route('auth.login'));
        }

        return $this->view->make('templates/base.core');
    }
}
