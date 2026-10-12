<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\ApiResponseHeaders;
use App\Http\Middleware\AuthenticateSession;
use App\Http\Middleware\WorkspaceContext;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', api: __DIR__.'/../routes/api.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(ApiResponseHeaders::class);
        $middleware->alias(['session.api' => AuthenticateSession::class, 'workspace' => WorkspaceContext::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $r, Throwable $e) => $r->is('api/*') || $r->expectsJson());
        $exceptions->render(function (Throwable $e, Request $r) {
            if (! $r->is('api/*')) {
                return null;
            }
            if ($e instanceof ValidationException) {
                return response()->json(['error' => ['code' => 'validation_error', 'message' => 'Revisa los campos indicados.', 'details' => $e->errors()]], 422);
            }
            $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : ($e instanceof ModelNotFoundException ? 404 : 500);
            $code = $e instanceof ApiException ? $e->errorCode : match ($status) {
                400 => 'bad_request',401 => 'unauthorized',403 => 'forbidden',404 => 'not_found',409 => 'workspace_mismatch',429 => 'rate_limited',503 => 'integration_not_configured',default => 'server_error'
            };

            return response()->json(['error' => ['code' => $code, 'message' => $status >= 500 ? 'El servicio no está disponible.' : ($e->getMessage() ?: 'No se pudo completar la solicitud.')]], $status, $e instanceof HttpExceptionInterface ? $e->getHeaders() : []);
        });
    })->create();
