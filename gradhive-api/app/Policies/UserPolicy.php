<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function updateProfile(User $actor, User $profile): bool
    {
        return $actor->id === $profile->id && in_array($profile->role, ['student', 'school'], true);
    }

    public function manageHighlights(User $actor, User $institution): bool
    {
        return $actor->id === $institution->id && $institution->role === 'school';
    }
}
