<?php

namespace Pterodactyl\Http\Middleware;

use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class AdminAuthenticate
{
    /**
     * Handle an incoming request.
     *
     * @throws \Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException
     */
    public function handle(Request $request, \Closure $next): mixed
    {
        $user = $request->user();
        if (!$user) {
            throw new AccessDeniedHttpException();
        }

        if ($user->root_admin || $user->isStaff()) {
            return $next($request);
        }

        throw new AccessDeniedHttpException('You do not have administrative privileges to access this area.');
    }
}
