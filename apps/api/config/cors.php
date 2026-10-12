<?php

return ['paths' => ['api/*'], 'allowed_methods' => ['*'], 'allowed_origins' => array_filter(explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'))), 'allowed_origins_patterns' => [], 'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'X-Workspace-ID'], 'exposed_headers' => [], 'max_age' => 600, 'supports_credentials' => false];
