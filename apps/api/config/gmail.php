<?php

return ['client_id' => env('GOOGLE_CLIENT_ID'), 'client_secret' => env('GOOGLE_CLIENT_SECRET'), 'redirect_uri' => env('GOOGLE_REDIRECT_URI', 'http://127.0.0.1:8000/api/v1/integrations/gmail/callback'), 'frontend_url' => env('FRONTEND_URL', 'http://127.0.0.1:3000/?view=settings'), 'initial_days' => 30];
