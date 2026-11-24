<?php

declare(strict_types=1);

namespace App\Modules\MasterData\Repositories;

use App\Core\BaseRepository;
use PDO;

final class GeographyRepository extends BaseRepository
{
    private const RESOURCES = [
        'provinces' => [
            'table' => 'provinces',
            'columns' => 'id, code, name, region, is_active',
            'parent_column' => null,
            'integer_columns' => ['id', 'is_active'],
        ],
        'districts' => [
            'table' => 'districts',
            'columns' => 'id, province_id, code, name, is_remote_area, is_active',
            'parent_column' => 'province_id',
            'integer_columns' => ['id', 'province_id', 'is_remote_area', 'is_active'],
        ],
        'wards' => [
            'table' => 'wards',
            'columns' => 'id, district_id, code, name, is_active',
            'parent_column' => 'district_id',
            'integer_columns' => ['id', 'district_id', 'is_active'],
        ],
    ];

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function paginate(string $resource, ?int $parentId, int $page, int $perPage): array
    {
        $definition = self::RESOURCES[$resource];
        $conditions = ['is_active = 1'];
        $parameters = [];
        if ($parentId !== null && $definition['parent_column'] !== null) {
            $conditions[] = $definition['parent_column'] . ' = :parent_id';
            $parameters[':parent_id'] = $parentId;
        }
        $where = implode(' AND ', $conditions);

        $countStatement = $this->pdo->prepare(
            'SELECT COUNT(*) FROM ' . $definition['table'] . ' WHERE ' . $where,
        );
        $countStatement->execute($parameters);
        $total = (int) $countStatement->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $statement = $this->pdo->prepare(
            'SELECT ' . $definition['columns']
            . ' FROM ' . $definition['table']
            . ' WHERE ' . $where
            . ' ORDER BY id ASC LIMIT :limit OFFSET :offset',
        );
        foreach ($parameters as $name => $value) {
            $statement->bindValue($name, $value, PDO::PARAM_INT);
        }
        $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return [
            'items' => array_map(
                fn (array $row): array => $this->normalizeRow($row, $definition['integer_columns']),
                $statement->fetchAll(PDO::FETCH_ASSOC),
            ),
            'total' => $total,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findActive(string $resource, int $id): ?array
    {
        $definition = self::RESOURCES[$resource];
        $statement = $this->pdo->prepare(
            'SELECT ' . $definition['columns']
            . ' FROM ' . $definition['table']
            . ' WHERE id = :id AND is_active = 1 LIMIT 1',
        );
        $statement->execute([':id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return $row === false
            ? null
            : $this->normalizeRow($row, $definition['integer_columns']);
    }

    /**
     * @param array<int, string> $integerColumns
     * @return array<string, mixed>
     */
    private function normalizeRow(array $row, array $integerColumns): array
    {
        foreach ($integerColumns as $column) {
            $row[$column] = (int) $row[$column];
        }

        return $row;
    }
}
