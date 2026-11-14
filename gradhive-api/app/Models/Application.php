<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Application extends Model
{
    protected $fillable = [
        'position_id', 'user_id', 'gpa', 'level', 'language_test', 'language_score', 'language_waiver',
        'motivation', 'documents', 'status',
    ];
    protected $casts = ['documents' => 'array', 'language_waiver' => 'boolean', 'gpa' => 'float'];

    public function position(): BelongsTo { return $this->belongsTo(Position::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
