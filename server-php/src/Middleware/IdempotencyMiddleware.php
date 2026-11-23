<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\ApiException;
use App\Core\Request;
use App\Core\Response;
use PDO;
use PDOException;
use Throwable;

final class IdempotencyMiddleware implements MiddlewareInterface
{
    private const STALE_PROCESSING_SECONDS = 60;

    private ?string $responseCodeColumn = null;

    public function __construct(private readonly PDO $pdo)
    {
    }

    public function process(Request $request, callable $next): Response
    {
        $auth = $request->attribute('auth');
        if (!is_array($auth) || !isset($auth['user_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Idempotency yêu cầu người dùng đã xác thực.');
        }

        $key = $request->idempotencyKey();
        if ($key === null || preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
            trim($key),
        ) !== 1) {
            throw new ApiException('400_BAD_REQUEST', 'Idempotency-Key phải là UUID v4 hợp lệ.');
        }

        $before = $this->handleBefore(
            (int) $auth['user_id'],
            trim($key),
            $request->method(),
            $request->path(),
            $request->rawBody(),
        );

        if ($before['replayed']) {
            return Response::fromStoredJson($before['body'], $before['status_code']);
        }

        $response = $next($request);
        if ($response->statusCode() >= 200 && $response->statusCode() < 300) {
            $this->markCompleted($before['record_id'], $response->statusCode(), $response->body());
        }

        return $response;
    }

    /**
     * @return array{replayed: true, status_code: int, body: string}|array{replayed: false, record_id: int}
     */
    public function handleBefore(
        int $userId,
        string $idempotencyKey,
        string $method,
        string $uri,
        string $rawBody,
    ): array {
        $requestHash = hash('sha256', strtoupper($method) . '|' . $uri . '|' . $rawBody);
        $responseCodeColumn = $this->responseCodeColumn();
        $this->pdo->beginTransaction();

        try {
            $statement = $this->pdo->prepare(
                'SELECT id, request_hash, status, ' . $responseCodeColumn . ' AS response_status, response_body,
                        TIMESTAMPDIFF(SECOND, created_at, NOW()) AS elapsed_seconds
                 FROM idempotency_keys
                 WHERE user_id = :user_id
                   AND idempotency_key = :idempotency_key
                 FOR UPDATE'
            );
            $statement->execute([
                ':user_id' => $userId,
                ':idempotency_key' => $idempotencyKey,
            ]);
            $existing = $statement->fetch(PDO::FETCH_ASSOC);

            if ($existing !== false) {
                if (!hash_equals((string) $existing['request_hash'], $requestHash)) {
                    throw new ApiException(
                        '409_IDEMPOTENCY_DUPLICATE',
                        'Idempotency-Key đã được sử dụng cho nội dung request khác.',
                    );
                }

                if ($existing['status'] === 'completed') {
                    if ($existing['response_status'] === null || $existing['response_body'] === null) {
                        throw new ApiException('500_INTERNAL_ERROR', 'Phản hồi Idempotency đã hoàn tất nhưng thiếu dữ liệu.');
                    }

                    $this->pdo->commit();

                    return [
                        'replayed' => true,
                        'status_code' => (int) $existing['response_status'],
                        'body' => (string) $existing['response_body'],
                    ];
                }

                if (
                    $existing['status'] !== 'processing'
                    || (int) $existing['elapsed_seconds'] < self::STALE_PROCESSING_SECONDS
                ) {
                    throw new ApiException(
                        '409_IDEMPOTENCY_DUPLICATE',
                        'Giao dịch đang được xử lý, vui lòng không gửi lặp lại.',
                    );
                }

                $resetStatement = $this->pdo->prepare(
                    'UPDATE idempotency_keys
                     SET created_at = NOW()
                     WHERE id = :id'
                );
                $resetStatement->execute([':id' => (int) $existing['id']]);
                $this->pdo->commit();

                return [
                    'replayed' => false,
                    'record_id' => (int) $existing['id'],
                ];
            }

            $insertStatement = $this->pdo->prepare(
                "INSERT INTO idempotency_keys
                    (user_id, idempotency_key, endpoint, request_hash, status, expires_at, created_at)
                 VALUES
                    (:user_id, :idempotency_key, :endpoint, :request_hash, 'processing',
                     DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW())"
            );
            $insertStatement->execute([
                ':user_id' => $userId,
                ':idempotency_key' => $idempotencyKey,
                ':endpoint' => strtoupper($method) . ' ' . $uri,
                ':request_hash' => $requestHash,
            ]);
            $recordId = (int) $this->pdo->lastInsertId();
            $this->pdo->commit();

            return [
                'replayed' => false,
                'record_id' => $recordId,
            ];
        } catch (Throwable $exception) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            if ($exception instanceof PDOException && (string) $exception->getCode() === '23000') {
                throw new ApiException(
                    '409_IDEMPOTENCY_DUPLICATE',
                    'Giao dịch đang được xử lý, vui lòng không gửi lặp lại.',
                    previous: $exception,
                );
            }

            throw $exception;
        }
    }

    public function markCompleted(int $recordId, int $statusCode, string $jsonBody): void
    {
        $responseCodeColumn = $this->responseCodeColumn();
        $statement = $this->pdo->prepare(
            "UPDATE idempotency_keys
             SET status = 'completed',
                 {$responseCodeColumn} = :status_code,
                 response_body = :response_body
             WHERE id = :id
               AND status = 'processing'"
        );
        $statement->execute([
            ':status_code' => $statusCode,
            ':response_body' => $jsonBody,
            ':id' => $recordId,
        ]);

        if ($statement->rowCount() !== 1) {
            throw new ApiException('500_INTERNAL_ERROR', 'Không thể lưu kết quả Idempotency.');
        }
    }

    private function responseCodeColumn(): string
    {
        if ($this->responseCodeColumn !== null) {
            return $this->responseCodeColumn;
        }

        $statement = $this->pdo->prepare('SHOW COLUMNS FROM idempotency_keys');
        $statement->execute();
        $columnNames = array_column($statement->fetchAll(PDO::FETCH_ASSOC), 'Field');

        foreach (['response_status', 'response_code'] as $candidate) {
            if (in_array($candidate, $columnNames, true)) {
                $this->responseCodeColumn = '`' . $candidate . '`';
                return $this->responseCodeColumn;
            }
        }

        throw new ApiException('500_INTERNAL_ERROR', 'Bảng idempotency_keys thiếu cột lưu HTTP status.');
    }
}
