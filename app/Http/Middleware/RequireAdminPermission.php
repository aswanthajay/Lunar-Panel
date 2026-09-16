<?php

namespace Pterodactyl\Http\Middleware;

use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class RequireAdminPermission
{
    /**
     * Handle an incoming request.
     *
     * @throws \Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException
     */
    public function handle(Request $request, \Closure $next, string ...$permissions): mixed
    {
        $user = $request->user();
        if (!$user) {
            throw new AccessDeniedHttpException('Unauthenticated.');
        }

        // Root administrators bypass all permission checks
        if ($user->root_admin) {
            return $next($request);
        }

        if (!$user->isStaff()) {
            throw new AccessDeniedHttpException('You do not have administrative staff privileges.');
        }

        // Check if staff has at least one of the required permissions
        foreach ($permissions as $permission) {
            if ($user->hasAdminPermission(trim($permission))) {
                return $next($request);
            }
        }

        throw new AccessDeniedHttpException('You do not have the required administrative permission [' . implode(', ', $permissions) . '] to access this section.');
    }
}
