<?php

namespace App\Http\Middleware;

use App\Models\Record;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $session = Record::table('api_sessions')->where('token_hash', hash('sha256', $request->bearerToken() ?? ''))->where('expires_at', '>', now())->first();
        abort_unless($session, 401, 'Sesión no válida o caducada.');
        abort_unless(Record::table('memberships')->where('user_id', $session->user_id)->where('workspace_id', $session->workspace_id)->exists(), 403, 'La membresía ya no está activa.');
        $request->attributes->set('api_session', $session);
        $request->setUserResolver(fn () => User::findOrFail($session->user_id));

        return $next($request);
    }
}
