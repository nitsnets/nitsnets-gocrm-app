<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class WorkspaceContext
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->header('X-Workspace-ID'), 400, 'X-Workspace-ID es obligatorio.');
        abort_unless($request->header('X-Workspace-ID') === $request->attributes->get('api_session')->workspace_id, 409, 'La empresa activa cambió. Recarga los datos.');

        return $next($request);
    }
}
