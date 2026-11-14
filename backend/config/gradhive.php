<?php

return [
    // Disque de stockage des PDF. "local" (dossier du serveur) pour le développement ;
    // "s3" (S3, Cloudflare R2, Supabase Storage…) en production : le disque d'un conteneur Render est éphémère.
    'files_disk' => env('GRADHIVE_FILES_DISK', 'local'),

    // Durée de vie d'un jeton d'accès, en minutes (8 h par défaut).
    'token_ttl_minutes' => (int) env('TOKEN_TTL_MINUTES', 480),
];
