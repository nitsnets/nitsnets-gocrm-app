<?php

return [
    'client_id' => env('GOOGLE_LOGIN_CLIENT_ID') ?: env('GOOGLE_CLIENT_ID'),
    'client_secret' => env('GOOGLE_LOGIN_CLIENT_SECRET') ?: env('GOOGLE_CLIENT_SECRET'),
    'redirect_uri' => env('GOOGLE_LOGIN_REDIRECT_URI', 'http://127.0.0.1:8000/api/v1/auth/google/callback'),
    'web_return_uri' => env('GOOGLE_LOGIN_WEB_RETURN_URI', 'http://127.0.0.1:3000/api/auth/google/callback'),
    'ios_return_uri' => env('GOOGLE_LOGIN_IOS_RETURN_URI', 'com.nitsnets.crm://oauth/google'),
];
