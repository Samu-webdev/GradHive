<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class OptionalSanctumAuthentication
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::guard('sanctum')->user();
        if ($user && $user->status !== 'active') {
            abort(403, 'Votre compte est suspendu.');
        }

        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
