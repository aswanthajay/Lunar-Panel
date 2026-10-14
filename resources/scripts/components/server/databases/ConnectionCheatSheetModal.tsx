import React, { useState } from 'react';
import Modal from '@/components/elements/Modal';
import { ServerDatabase } from '@/api/server/databases/getServerDatabases';

interface Props {
    database: ServerDatabase;
    visible: boolean;
    onDismissed: () => void;
}

type TabType = 'env' | 'node' | 'python' | 'php' | 'jdbc' | 'cli';

export const ConnectionCheatSheetModal: React.FC<Props> = ({ database, visible, onDismissed }) => {
    const [tab, setTab] = useState<TabType>('env');
    const [copied, setCopied] = useState<string | null>(null);

    const parts = (database.connectionString || '').split(':');
    const dbHost = parts[0] || '127.0.0.1';
    const dbPort = parts[1] || '3306';
    const dbPass = database.password || 'YOUR_PASSWORD';

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const getSnippet = () => {
        switch (tab) {
            case 'env':
                return `# Database Configuration (.env)
DB_CONNECTION=mysql
DB_HOST=${dbHost}
DB_PORT=${dbPort}
DB_DATABASE=${database.name}
DB_USERNAME=${database.username}
DB_PASSWORD=${dbPass}`;

            case 'node':
                return `// Prisma (schema.prisma)
datasource db {
  provider = "mysql"
  url      = "mysql://${database.username}:${encodeURIComponent(dbPass)}@${dbHost}:${dbPort}/${database.name}"
}

// mysql2 / Drizzle
const connection = await mysql.createConnection({
  host: '${dbHost}',
  port: ${dbPort},
  user: '${database.username}',
  password: '${dbPass}',
  database: '${database.name}'
});`;

            case 'python':
                return `# SQLAlchemy URI
DATABASE_URL = "mysql+pymysql://${database.username}:${encodeURIComponent(dbPass)}@${dbHost}:${dbPort}/${database.name}"

# Django settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': '${database.name}',
        'USER': '${database.username}',
        'PASSWORD': '${dbPass}',
        'HOST': '${dbHost}',
        'PORT': '${dbPort}',
    }
}`;

            case 'php':
                return `<?php
// PDO Connection
$dsn = "mysql:host=${dbHost};port=${dbPort};dbname=${database.name};charset=utf8mb4";
$pdo = new PDO($dsn, "${database.username}", "${dbPass}", [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

// WordPress (wp-config.php)
define('DB_NAME', '${database.name}');
define('DB_USER', '${database.username}');
define('DB_PASSWORD', '${dbPass}');
define('DB_HOST', '${database.connectionString}');`;

            case 'jdbc':
                return `// Java JDBC Connection String
String url = "jdbc:mysql://${dbHost}:${dbPort}/${database.name}?useSSL=false&allowPublicKeyRetrieval=true";
Connection conn = DriverManager.getConnection(url, "${database.username}", "${dbPass}");

# Spring Boot application.properties
spring.datasource.url=jdbc:mysql://${dbHost}:${dbPort}/${database.name}
spring.datasource.username=${database.username}
spring.datasource.password=${dbPass}`;

            case 'cli':
                return `# MySQL Terminal CLI Client
mysql -h ${dbHost} -P ${dbPort} -u ${database.username} -p'${dbPass}' ${database.name}

# mysqldump backup command
mysqldump -h ${dbHost} -P ${dbPort} -u ${database.username} -p'${dbPass}' ${database.name} > backup.sql`;
        }
    };

    return (
        <Modal visible={visible} onDismissed={onDismissed} showSpinnerOverlay={false}>
            <div className="w-full max-w-3xl p-2">
                <div className="flex items-center justify-between pb-4 border-b border-[#1F1F1F]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center text-neutral-300">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-base font-medium text-white tracking-tight">Connection Snippets</h3>
                            <p className="text-xs text-neutral-500">Ready-to-use configuration strings for popular stacks</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onDismissed}
                        className="text-neutral-500 hover:text-white p-1 rounded-md transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 my-3 overflow-x-auto select-none border-b border-[#141414] pb-2">
                    {(['env', 'node', 'python', 'php', 'jdbc', 'cli'] as TabType[]).map((t) => {
                        const labels: Record<TabType, string> = {
                            env: '.env',
                            node: 'Node.js / Prisma',
                            python: 'Python',
                            php: 'PHP / WordPress',
                            jdbc: 'Java / JDBC',
                            cli: 'Terminal / CLI',
                        };
                        return (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors shrink-0 ${
                                    tab === t
                                        ? 'bg-white/[0.08] text-white font-medium border border-white/[0.08]'
                                        : 'text-neutral-400 hover:text-white hover:bg-[#0A0A0A]'
                                }`}
                            >
                                {labels[t]}
                            </button>
                        );
                    })}
                </div>

                {/* Code Snippet Box */}
                <div className="relative rounded-lg overflow-hidden border border-[#1F1F1F] bg-[#050505]">
                    <div className="flex items-center justify-between px-3 py-2 bg-[#0A0A0A] border-t-0 border-b border-[#141414] text-[11px] text-neutral-500 font-mono">
                        <span>{database.name} configuration</span>
                        <button
                            type="button"
                            onClick={() => handleCopy(getSnippet(), 'snippet')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white transition-colors"
                        >
                            {copied === 'snippet' ? (
                                <>
                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-emerald-400 font-medium">Copied!</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <span>Copy Snippet</span>
                                </>
                            )}
                        </button>
                    </div>
                    <pre className="p-4 text-xs font-mono text-neutral-200 overflow-x-auto custom-scrollbar leading-relaxed">
                        <code>{getSnippet()}</code>
                    </pre>
                </div>
            </div>
        </Modal>
    );
};
