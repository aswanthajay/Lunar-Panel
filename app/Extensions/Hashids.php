<?php

namespace Pterodactyl\Extensions;

use Hashids\Hashids as VendorHashids;
use Pterodactyl\Contracts\Extensions\HashidsInterface;

class Hashids extends VendorHashids implements HashidsInterface
{
    /**
     * {@inheritdoc}
     */
    public function decodeFirst(string $encoded, string $default = null): mixed
    {
        $result = $this->decode($encoded);
        if (!is_array($result) || empty($result)) {
            return $default;
        }

        return $result[0] ?? $default;
    }
}
