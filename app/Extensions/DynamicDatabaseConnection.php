<?php

namespace Pterodactyl\Extensions;

use Pterodactyl\Models\DatabaseHost;
use Illuminate\Contracts\Encryption\Encrypter;
use Illuminate\Config\Repository as ConfigRepository;
use Pterodactyl\Contracts\Repository\DatabaseHostRepositoryInterface;

class DynamicDatabaseConnection
{
    public const DB_CHARSET = 'utf8';
    public const DB_COLLATION = 'utf8_unicode_ci';
    public const DB_DRIVER = 'mysql';

    /**
     * DynamicDatabaseConnection constructor.
     */
    public function __construct(
        protected ConfigRepository $config,
        protected Encrypter $encrypter,
        protected DatabaseHostRepositoryInterface $repository
    ) {
    }

    /**
     * Adds a dynamic database connection entry to the runtime config.
     *
     * @throws \Pterodactyl\Exceptions\Repository\RecordNotFoundException
     */
    public function set(string $connection, DatabaseHost|int $host, string $database = 'mysql'): void
    {
        if (!$host instanceof DatabaseHost) {
            $host = $this->repository->find($host);
        }

        $targetHost = $host->host;
        $targetPort = (int) ($host->port ?: 3306);

        // If the database host is configured with an external IP or FQDN (e.g. terminal.lunarcloud.in),
        // test whether connecting from the panel machine directly succeeds.
        // If external TCP connection fails (due to firewall or MySQL binding only to 127.0.0.1/socket),
        // fallback to 127.0.0.1 so local database operations never fail.
        if ($targetHost !== '127.0.0.1' && $targetHost !== 'localhost') {
            $fp = @fsockopen($targetHost, $targetPort, $errno, $errstr, 1);
            if ($fp) {
                fclose($fp);
            } else {
                $fpLocal = @fsockopen('127.0.0.1', $targetPort, $errno, $errstr, 1);
                if ($fpLocal) {
                    fclose($fpLocal);
                    $targetHost = '127.0.0.1';
                }
            }
        }

        $this->config->set('database.connections.' . $connection, [
            'driver' => self::DB_DRIVER,
            'host' => $targetHost,
            'port' => $targetPort,
            'database' => $database,
            'username' => $host->username,
            'password' => $this->encrypter->decrypt($host->password),
            'charset' => self::DB_CHARSET,
            'collation' => self::DB_COLLATION,
        ]);

        if (function_exists('app') && app()->bound('db')) {
            app('db')->purge($connection);
        }
    }
}
