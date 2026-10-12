<?php

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

class ApiException extends HttpException
{
    public function __construct(int $status, public string $errorCode, string $message)
    {
        parent::__construct($status, $message);
    }
}
