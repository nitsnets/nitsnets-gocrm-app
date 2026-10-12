<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

abstract class Controller
{
    protected function validateInput(Request $request, array $rules): array
    {
        $unknown = array_diff(array_keys($request->all()), array_keys($rules));
        if ($unknown) {
            throw ValidationException::withMessages(array_fill_keys($unknown, 'Campo no permitido.'));
        }

        return $request->validate($rules);
    }
}
