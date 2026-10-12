<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['service' => 'NitsNets CRM API', 'version' => 'v1', 'health' => '/api/v1/health']));
