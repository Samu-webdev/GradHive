<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InstitutionHighlight extends Model
{
    protected $fillable = ['institution_user_id', 'student_user_id', 'title', 'message', 'sort_order'];

    public function institution(): BelongsTo
    {
        return $this->belongsTo(User::class, 'institution_user_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }
}
