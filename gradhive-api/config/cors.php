<?php

// Origines autorisées : liste séparée par des virgules (ex. https://gradhive.vercel.app).
// Par défaut, seul le serveur de développement Angular est autorisé. Le joker "*" est refusé en production.
$origins = array_values(array_filter(array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:4200')))));
if (env('APP_ENV') === 'production' && in_array('*', $origins, true)) {
    $origins = []; // configuration dangereuse : on n'autorise personne plutôt que tout le monde
}

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => $origins,
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
    'exposed_headers' => [],
    'max_age' => 600,
    'supports_credentials' => false, // authentification par jeton Bearer, pas de cookies
];
