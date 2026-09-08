<?php

namespace Pterodactyl\Services\Databases;

use Pterodactyl\Models\Database;
use Pterodactyl\Helpers\Utilities;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Contracts\Encryption\Encrypter;
use Pterodactyl\Extensions\DynamicDatabaseConnection;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Contracts\Repository\DatabaseRepositoryInterface;
use Illuminate\Support\Facades\Log;

class DatabasePasswordService
{
    /**
     * DatabasePasswordService constructor.
     */
    public function __construct(
        private ConnectionInterface $connection,
        private DynamicDatabaseConnection $dynamic,
        private Encrypter $encrypter,
        private DatabaseRepositoryInterface $repository
    ) {
    }

    /**
     * Updates a password for a given database.
     *
     * @throws \Throwable
     */
    public function handle(Database|int $database): string
    {
        if (!$database instanceof Database) {
            $database = $this->repository->find($database);
        }

        $password = Utilities::randomStringWithSpecialCharacters(24);

        try {
            $this->connection->transaction(function () use ($database, $password) {
                $this->dynamic->set('dynamic', $database->database_host_id);

                $this->repository->withoutFreshModel()->update($database->id, [
                    'password' => $this->encrypter->encrypt($password),
                ]);

                $this->repository->dropUser($database->username, $database->remote);
                $this->repository->createUser($database->username, $database->remote, $password, $database->max_connections);
                $this->repository->assignUserToDatabase($database->database, $database->username, $database->remote);
                $this->repository->flush();
            });
        } catch (\Throwable $e) {
            Log::error("DatabasePasswordService error for database [{$database->id}]: " . $e->getMessage(), [
                'database' => $database->database,
                'username' => $database->username,
                'host_id' => $database->database_host_id,
            ]);

            throw new DisplayException('Unable to rotate database password on MySQL host: ' . $e->getMessage(), $e);
        }

        return $password;
    }
}
