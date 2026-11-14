<?php

namespace App\Policies;

use App\Models\AcademicWork;
use App\Models\User;

class AcademicWorkPolicy
{
    public function view(User $user, AcademicWork $work): bool
    {
        return $work->visibility === 'public' || $this->owns($user, $work);
    }

    public function update(User $user, AcademicWork $work): bool
    {
        return $this->owns($user, $work);
    }

    public function delete(User $user, AcademicWork $work): bool
    {
        return $this->owns($user, $work);
    }

    private function owns(User $user, AcademicWork $work): bool
    {
        return $user->role === 'student' && $work->author_id === $user->id;
    }
}
