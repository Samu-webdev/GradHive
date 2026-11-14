<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InstitutionPost extends Model
{
    protected $fillable = ['institution_user_id', 'title', 'body'];

    public function institution(): BelongsTo
    {
        return $this->belongsTo(User::class, 'institution_user_id');
    }

    public function present(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,
            'institution' => $this->institution?->toCard(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
