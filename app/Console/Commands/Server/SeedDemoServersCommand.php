<?php

namespace Pterodactyl\Console\Commands\Server;

use Ramsey\Uuid\Uuid;
use Illuminate\Support\Str;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\User;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Server;
use Illuminate\Console\Command;
use Pterodactyl\Models\Allocation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Pterodactyl\Models\EggVariable;

class SeedDemoServersCommand extends Command
{
    protected $signature = 'p:server:seed-demo';
    protected $description = 'Seed 3 test servers for admin and 5 test servers for customers with realistic INR billing amounts and expiry dates.';

    public function handle()
    {
        $this->info('Starting test servers and customers generation...');

        $node = Node::first();
        if (!$node) {
            $this->error('No node found in database. Cannot create servers.');
            return 1;
        }

        // 1. Get or Create Admin User
        $admin = User::where('root_admin', true)->first();
        if (!$admin) {
            $admin = User::create([
                'uuid' => Uuid::uuid4()->toString(),
                'username' => 'stellaradmin',
                'email' => 'admin@stellar.local',
                'name_first' => 'Stellar',
                'name_last' => 'Admin',
                'password' => Hash::make('Password123!'),
                'language' => 'en',
                'root_admin' => true,
            ]);
        }

        // 2. Create 2 Customer Users
        $customer1 = User::where('email', 'alex.craft@gmail.com')->first();
        if (!$customer1) {
            $customer1 = new User();
            $customer1->forceFill([
                'uuid' => Uuid::uuid4()->toString(),
                'username' => 'alexcraft',
                'email' => 'alex.craft@gmail.com',
                'name_first' => 'Alex',
                'name_last' => 'Craft',
                'password' => Hash::make('Customer123!'),
                'language' => 'en',
                'root_admin' => false,
            ])->saveOrFail();
        }

        $customer2 = User::where('email', 'rustlord@protonmail.com')->first();
        if (!$customer2) {
            $customer2 = new User();
            $customer2->forceFill([
                'uuid' => Uuid::uuid4()->toString(),
                'username' => 'rustlord',
                'email' => 'rustlord@protonmail.com',
                'name_first' => 'Jordan',
                'name_last' => 'Rust',
                'password' => Hash::make('Customer123!'),
                'language' => 'en',
                'root_admin' => false,
            ])->saveOrFail();
        }

        $this->info("Users configured: Admin ({$admin->username}), Customers ({$customer1->username}, {$customer2->username})");

        // 3. Update existing Admin Server 1 if present
        $existingAdminServer = Server::where('owner_id', $admin->id)->first();
        if ($existingAdminServer) {
            $existingAdminServer->update([
                'name' => 'Lunar Minecraft Server',
                'description' => 'High performance Lunar Minecraft instance (Paper 1.21)',
                'expires_at' => now()->addDays(41),
                'billing_amount' => 899,
                'status' => null,
            ]);
            $this->info("Updated existing Server 1: {$existingAdminServer->name} (₹899, expires in 41d)");
        }

        // Define the target servers
        // 3 servers for admin total (1 updated + 2 new)
        // 5 servers for customers (3 for alexcraft, 2 for rustlord)
        $serversToCreate = [
            // Admin Server 2
            [
                'owner' => $admin,
                'name' => 'Bungeecord Network Proxy',
                'description' => 'Main high-throughput network proxy node',
                'egg_id' => 1, // Bungeecord
                'memory' => 1024,
                'cpu' => 100,
                'disk' => 5120,
                'expires_at' => now()->addDays(58),
                'billing_amount' => 499,
                'status' => null,
                'port' => 25566,
            ],
            // Admin Server 3
            [
                'owner' => $admin,
                'name' => 'CS2 Match Arena 128T',
                'description' => 'Competitive esports scrimmage server',
                'egg_id' => 7, // CS:GO / Source
                'memory' => 4096,
                'cpu' => 250,
                'disk' => 15360,
                'expires_at' => now()->addDays(77),
                'billing_amount' => 799,
                'status' => null,
                'port' => 25567,
            ],

            // Customer Server 1 (Alex)
            [
                'owner' => $customer1,
                'name' => 'Survival SMP Season 4',
                'description' => 'PaperMC 1.21 survival multiplayer server',
                'egg_id' => 3, // Paper
                'memory' => 8192,
                'cpu' => 350,
                'disk' => 30720,
                'expires_at' => now()->addDays(22),
                'billing_amount' => 899,
                'status' => null,
                'port' => 25568,
            ],
            // Customer Server 2 (Alex)
            [
                'owner' => $customer1,
                'name' => 'Forge Modded Origins',
                'description' => 'Heavy 150+ modpack instance for friends',
                'egg_id' => 2, // Forge
                'memory' => 12288,
                'cpu' => 400,
                'disk' => 40960,
                'expires_at' => now()->addDays(3), // Expiring soon!
                'billing_amount' => 1499,
                'status' => null,
                'port' => 25569,
            ],
            // Customer Server 3 (Jordan)
            [
                'owner' => $customer2,
                'name' => 'Rust 2x Vanilla Weekly',
                'description' => 'Procedural high-pop PvP weekly wipe',
                'egg_id' => 14, // Rust
                'memory' => 16384,
                'cpu' => 400,
                'disk' => 51200,
                'expires_at' => now()->addDays(18),
                'billing_amount' => 1899,
                'status' => null,
                'port' => 25570,
            ],
            // Customer Server 4 (Jordan)
            [
                'owner' => $customer2,
                'name' => 'Ark Survival Island Dedicated',
                'description' => 'Crossplay Ark survival dedicated map',
                'egg_id' => 6, // Ark
                'memory' => 12288,
                'cpu' => 300,
                'disk' => 40960,
                'expires_at' => now()->subDays(2), // Expired 2 days ago!
                'billing_amount' => 1499,
                'status' => 'suspended',
                'port' => 25571,
            ],
            // Customer Server 5 (Alex)
            [
                'owner' => $customer1,
                'name' => 'Vanilla Minecraft Hardcore',
                'description' => 'Pure vanilla hardcore 1-life SMP',
                'egg_id' => 5, // Vanilla Minecraft
                'memory' => 4096,
                'cpu' => 200,
                'disk' => 15360,
                'expires_at' => now()->subDays(5), // Expired 5 days ago!
                'billing_amount' => 499,
                'status' => 'suspended',
                'port' => 25572,
            ],
        ];

        foreach ($serversToCreate as $data) {
            $existing = Server::where('name', $data['name'])->first();
            if ($existing) {
                $existing->update([
                    'owner_id' => $data['owner']->id,
                    'description' => $data['description'],
                    'expires_at' => $data['expires_at'],
                    'billing_amount' => $data['billing_amount'],
                    'status' => $data['status'],
                    'memory' => $data['memory'],
                    'cpu' => $data['cpu'],
                    'disk' => $data['disk'],
                ]);
                $this->info("Updated existing server: {$data['name']} ({$data['owner']->username})");
                continue;
            }

            // Get or create Allocation
            $allocation = Allocation::firstOrCreate(
                ['node_id' => $node->id, 'ip' => '127.0.0.1', 'port' => $data['port']],
                ['ip_alias' => 'localhost']
            );

            /** @var \Pterodactyl\Models\Egg $egg */
            $egg = Egg::findOrFail($data['egg_id']);
            $images = is_array($egg->docker_images) ? $egg->docker_images : (json_decode($egg->docker_images, true) ?: []);
            $defaultImage = reset($images) ?: 'ghcr.io/pterodactyl/yolks:java_21';

            $uuid = Uuid::uuid4()->toString();
            $uuidShort = substr($uuid, 0, 8);

            $server = new Server();
            $server->forceFill([
                'uuid' => $uuid,
                'uuidShort' => $uuidShort,
                'node_id' => $node->id,
                'name' => $data['name'],
                'description' => $data['description'],
                'status' => $data['status'],
                'expires_at' => $data['expires_at'],
                'billing_amount' => $data['billing_amount'],
                'skip_scripts' => false,
                'owner_id' => $data['owner']->id,
                'memory' => $data['memory'],
                'swap' => 0,
                'disk' => $data['disk'],
                'io' => 500,
                'cpu' => $data['cpu'],
                'threads' => null,
                'oom_disabled' => true,
                'allocation_id' => $allocation->id,
                'nest_id' => $egg->nest_id,
                'egg_id' => $egg->id,
                'startup' => $egg->startup,
                'image' => $defaultImage,
                'allocation_limit' => 2,
                'database_limit' => 2,
                'backup_limit' => 3,
                'installed_at' => now(),
            ]);
            $server->saveOrFail();

            // Assign allocation to server
            $allocation->update(['server_id' => $server->id]);

            // Seed default Egg variables into server_variables
            $eggVars = EggVariable::where('egg_id', $egg->id)->get();
            foreach ($eggVars as $eggVar) {
                DB::table('server_variables')->insert([
                    'server_id' => $server->id,
                    'variable_id' => $eggVar->id,
                    'variable_value' => $eggVar->default_value ?? '',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $userType = $data['owner']->id === $admin->id ? 'ADMIN' : 'CUSTOMER';
            $this->info("Created [{$userType}] Server ID #{$server->id}: {$server->name} | Owner: {$data['owner']->username} | Expiry: {$data['expires_at']->format('Y-m-d')} | Renewal: ₹{$data['billing_amount']}");
        }

        $adminServersCount = Server::where('owner_id', $admin->id)->count();
        $customerServersCount = Server::where('owner_id', '!=', $admin->id)->count();

        $this->info("--------------------------------------------------");
        $this->info("Completed successfully!");
        $this->info("Admin Servers Total: {$adminServersCount}");
        $this->info("Customer Servers Total: {$customerServersCount}");
        $this->info("Total Servers in Fleet: " . Server::count());

        return 0;
    }
}
