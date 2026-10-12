<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CrmController;
use App\Http\Controllers\GmailController;
use App\Http\Controllers\GoogleLoginController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('health', fn () => ['data' => ['status' => 'ok']]);
    Route::get('auth/google', [GoogleLoginController::class, 'status']);
    Route::post('auth/google/start', [GoogleLoginController::class, 'start'])->middleware('throttle:10,1,google-start:');
    Route::get('auth/google/callback', [GoogleLoginController::class, 'callback'])->middleware('throttle:30,1,google-callback:');
    Route::post('auth/google/exchange', [GoogleLoginController::class, 'exchange'])->middleware('throttle:20,1,google-exchange:');
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1,login:');
    Route::get('integrations/gmail/callback', [GmailController::class, 'callback'])->name('gmail.callback')->middleware('throttle:30,1,oauth:');
    Route::middleware(['session.api', 'throttle:120,1,api:'])->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('session/workspace', [AuthController::class, 'switchWorkspace']);
        Route::middleware('workspace')->group(function () {
            Route::get('dashboard', [CrmController::class, 'dashboard']);
            Route::get('members', [CrmController::class, 'members']);
            Route::match(['get', 'post'], 'contacts/{id}/affiliations', [CrmController::class, 'affiliations'])->whereUuid('id');
            Route::patch('affiliations/{id}', [CrmController::class, 'update'])->defaults('entity', 'affiliations')->whereUuid('id');
            foreach (['contacts', 'companies', 'opportunities', 'tasks', 'notes', 'events', 'quotes'] as $entity) {
                Route::get($entity, [CrmController::class, 'index'])->defaults('entity', $entity);
                Route::post($entity, [CrmController::class, 'store'])->defaults('entity', $entity);
                Route::get($entity.'/{id}', [CrmController::class, 'show'])->defaults('entity', $entity)->whereUuid('id');
                Route::patch($entity.'/{id}', [CrmController::class, 'update'])->defaults('entity', $entity)->whereUuid('id');
                Route::delete($entity.'/{id}', [CrmController::class, 'destroy'])->defaults('entity', $entity)->whereUuid('id');
            }
            Route::get('messages', [CrmController::class, 'index'])->defaults('entity', 'messages');
            Route::get('messages/{id}', [CrmController::class, 'show'])->defaults('entity', 'messages')->whereUuid('id');
            Route::post('messages/{id}/grants', [CrmController::class, 'grant'])->whereUuid('id');
            Route::delete('messages/{id}/grants/{grantId}', [CrmController::class, 'revoke'])->whereUuid(['id', 'grantId']);
            Route::get('integrations/gmail', [GmailController::class, 'status']);
            Route::post('integrations/gmail/connect', [GmailController::class, 'connect']);
            Route::post('integrations/gmail/sync', [GmailController::class, 'sync']);
            Route::delete('integrations/gmail', [GmailController::class, 'disconnect']);
        });
    });
});
