<?php

declare(strict_types=1);

namespace App\Core;

use DateTimeImmutable;
use DateTimeZone;
use ErrorException;
use PDO;
use Throwable;

final class ErrorHandler
{
    private static ?Request $request = null;

    public static function register(): void
    {
        set_exception_handler([self::class, 'handle']);
        set_error_handler(static function (
            int $severity,
            string $message,
            string $file,
            int $line,
        ): bool {
            if ((error_reporting() & $severity) === 0) {
                return false;
            }

            throw new ErrorException($message, 0, $severity, $file, $line);
        });
    }

    public static function setCurrentRequest(Request $request): void
    {
        self::$request = $request;
    }

    public static function handle(Throwable $exception): never
    {
        if ($exception instanceof ApiException && $exception->errorCode !== '500_INTERNAL_ERROR') {
            Response::error(
                $exception->errorCode,
                $exception->getMessage(),
                $exception->details,
                $exception->httpStatus,
            )->send();
            exit(1);
        }

        $traceId = self::newTraceId();
        self::writeErrorLog($exception, $traceId);
        Response::error(
            '500_INTERNAL_ERROR',
            'Lỗi hệ thống nội bộ.',
            [],
            500,
            $traceId,
        )->send();
        exit(1);
    }

    private static function newTraceId(): string
    {
        $timezone = new DateTimeZone('+07:00');
        return 'ERR-' . (new DateTimeImmutable('now', $timezone))->format('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
    }

    private static function writeErrorLog(Throwable $exception, string $traceId): void
    {
        try {
            self::writeDatabaseLog($exception, $traceId);
        } catch (Throwable $loggingException) {
            self::writeFallbackLog($exception, $traceId, $loggingException);
        }
    }

    private static function writeDatabaseLog(Throwable $exception, string $traceId): void
    {
        $pdo = Database::getConnection();
        $columnStatement = $pdo->prepare('SHOW COLUMNS FROM system_error_logs');
        $columnStatement->execute();
        $schemaColumns = $columnStatement->fetchAll(PDO::FETCH_ASSOC);
        $request = self::$request;
        $auth = $request?->attribute('auth');
        $userId = is_array($auth) && isset($auth['user_id']) ? (int) $auth['user_id'] : null;
        $message = '[' . $traceId . '] ' . $exception->getMessage();
        $stackTrace = $exception->getTraceAsString();
        $createdAt = (new DateTimeImmutable('now', new DateTimeZone('+07:00')))->format('Y-m-d H:i:s');
        $valuesByColumn = [
            'trace_id' => $traceId,
            'error_level' => 'error',
            'error_code' => '500_INTERNAL_ERROR',
            'error_type' => get_class($exception),
            'exception_class' => get_class($exception),
            'message' => $message,
            'error_message' => $message,
            'file' => $exception->getFile(),
            'file_path' => $exception->getFile(),
            'line' => $exception->getLine(),
            'line_number' => $exception->getLine(),
            'stack_trace' => $stackTrace,
            'request_method' => $request?->method(),
            'method' => $request?->method(),
            'request_uri' => $request?->path(),
            'uri' => $request?->path(),
            'ip_address' => $request?->ipAddress(),
            'user_agent' => $request?->userAgent(),
            'user_id' => $userId,
            'created_at' => $createdAt,
        ];

        $availableColumns = [];
        $requiredColumns = [];
        foreach ($schemaColumns as $column) {
            $name = (string) ($column['Field'] ?? '');
            if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name) !== 1) {
                continue;
            }

            if (array_key_exists($name, $valuesByColumn)) {
                $availableColumns[$name] = $valuesByColumn[$name];
            }

            $isAutoIncrement = str_contains(strtolower((string) ($column['Extra'] ?? '')), 'auto_increment');
            if (
                ($column['Null'] ?? 'YES') === 'NO'
                && ($column['Default'] ?? null) === null
                && !$isAutoIncrement
                && !array_key_exists($name, $valuesByColumn)
            ) {
                $requiredColumns[] = $name;
            }
        }

        if ($availableColumns === [] || $requiredColumns !== []) {
            throw new \RuntimeException('system_error_logs schema does not expose a compatible log record.');
        }

        $columnNames = array_keys($availableColumns);
        $placeholders = [];
        $parameters = [];
        foreach ($columnNames as $index => $columnName) {
            $placeholder = ':log_' . $index;
            $placeholders[] = $placeholder;
            $parameters[$placeholder] = $availableColumns[$columnName];
        }

        $quotedColumns = array_map(
            static fn (string $columnName): string => '`' . $columnName . '`',
            $columnNames,
        );
        $insertStatement = $pdo->prepare(
            'INSERT INTO `system_error_logs` (' . implode(', ', $quotedColumns) . ')'
            . ' VALUES (' . implode(', ', $placeholders) . ')',
        );
        $insertStatement->execute($parameters);
    }

    private static function writeFallbackLog(
        Throwable $exception,
        string $traceId,
        ?Throwable $loggingException = null,
    ): void {
        $request = self::$request;
        $record = [
            'trace_id' => $traceId,
            'created_at' => (new DateTimeImmutable('now', new DateTimeZone('+07:00')))->format(DATE_ATOM),
            'exception_class' => get_class($exception),
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'stack_trace' => $exception->getTraceAsString(),
            'request_method' => $request?->method(),
            'request_uri' => $request?->path(),
            'ip_address' => $request?->ipAddress(),
            'user_agent' => $request?->userAgent(),
            'logging_failure' => $loggingException?->getMessage(),
        ];
        try {
            $line = json_encode(
                $record,
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
            ) . PHP_EOL;
        } catch (Throwable) {
            $line = '{"trace_id":"' . $traceId . '","message":"Error log serialization failed"}' . PHP_EOL;
        }
        $logPath = dirname(__DIR__, 2) . '/storage/logs/error.log';

        try {
            $writtenBytes = file_put_contents($logPath, $line, FILE_APPEND | LOCK_EX);
            if ($writtenBytes === false) {
                error_log(trim($line));
            }
        } catch (Throwable) {
            error_log(trim($line));
        }
    }
}
