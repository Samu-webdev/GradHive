<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;

abstract class Controller
{
    use AuthorizesRequests;

    /** Refuse l'accès (403) si le rôle de l'utilisateur n'est pas autorisé. */
    protected function authorizeRole(Request $request, array $roles): void
    {
        abort_unless(in_array($request->user()?->role, $roles, true), 403, 'Action non autorisée pour votre rôle.');
    }
}
