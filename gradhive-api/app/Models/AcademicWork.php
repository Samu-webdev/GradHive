<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademicWork extends Model
{
    protected $table = 'academic_works';

    protected $fillable = [
        'author_id', 'title', 'abstract', 'theme', 'level', 'year', 'mention', 'supervisor', 'keywords',
        'institution', 'file_path', 'file_name', 'views', 'type', 'visibility',
    ];

    protected $casts = ['keywords' => 'array', 'year' => 'integer', 'views' => 'integer'];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function present(bool $withFile = false): array
    {
        $out = [
            'id' => $this->id, 'title' => $this->title, 'abstract' => $this->abstract, 'theme' => $this->theme,
            'level' => $this->level, 'year' => $this->year, 'mention' => $this->mention, 'supervisor' => $this->supervisor,
            'type' => $this->type, 'visibility' => $this->visibility,
            'keywords' => $this->keywords ?? [], 'author_id' => $this->author_id,
            'author_name' => $this->author?->name, 'institution' => $this->institution, 'views' => $this->views,
            'created_at' => $this->created_at?->toIso8601String(), 'file_available' => (bool) $this->file_path,
        ];
        if ($withFile) {
            $out['file_name'] = $this->file_name;
        }

        return $out;
    }
}
