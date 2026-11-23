<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOStatement;
use InvalidArgumentException;

abstract class BaseRepository
{
    public function __construct(protected readonly PDO $pdo)
    {
    }

    /**
     * @param array<string, string> $allowedColumns
     */
    protected function buildOrderBy(
        string $requestedColumn,
        string $requestedDirection,
        array $allowedColumns,
        string $defaultColumn,
    ): string {
        if (!isset($allowedColumns[$defaultColumn])) {
            throw new InvalidArgumentException('The default sort column must be whitelisted.');
        }

        $column = $allowedColumns[$requestedColumn] ?? $allowedColumns[$defaultColumn];
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/', $column) !== 1) {
            throw new InvalidArgumentException('Sort columns must be simple qualified identifiers.');
        }

        $direction = strtoupper($requestedDirection) === 'ASC' ? 'ASC' : 'DESC';

        return $column . ' ' . $direction;
    }

    /**
     * @param array<int, scalar|null> $values
     * @return array{sql: string, params: array<string, scalar|null>}
     */
    protected function buildInClause(array $values, string $parameterPrefix = 'value'): array
    {
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $parameterPrefix) !== 1) {
            throw new InvalidArgumentException('IN parameter prefixes must be valid identifiers.');
        }

        if ($values === []) {
            return ['sql' => 'NULL', 'params' => []];
        }

        $placeholders = [];
        $parameters = [];
        foreach (array_values($values) as $index => $value) {
            $placeholder = ':' . $parameterPrefix . '_' . $index;
            $placeholders[] = $placeholder;
            $parameters[$placeholder] = $value;
        }

        return [
            'sql' => implode(', ', $placeholders),
            'params' => $parameters,
        ];
    }

    protected function assertOptimisticLock(PDOStatement $statement): void
    {
        if ($statement->rowCount() === 0) {
            throw new ApiException(
                '409_VERSION_CONFLICT',
                'Dữ liệu đã được cập nhật bởi người dùng khác. Vui lòng tải lại.',
            );
        }
    }
}
