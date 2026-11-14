<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class PdfStorage
{
    public function store(UploadedFile $file, string $directory): string
    {
        $path = $file->storeAs($directory, Str::uuid()->toString().'.pdf', config('gradhive.files_disk'));

        if (! is_string($path)) {
            throw new RuntimeException('Unable to store uploaded PDF.');
        }

        return $path;
    }

    public function delete(array|string|null $paths): void
    {
        if (! $paths) {
            return;
        }

        Storage::disk(config('gradhive.files_disk'))->delete((array) $paths);
    }
}
