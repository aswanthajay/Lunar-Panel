/**
 * Client-side code and configuration formatter for Better Files Manager.
 * Supports JSON, YAML, XML/HTML, INI/Properties, and general indentation cleanup.
 */

export interface FormatResult {
    success: boolean;
    formatted: string;
    error?: string;
}

export const formatCode = (content: string, filename: string, mode?: string): FormatResult => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const cleanMode = (mode || '').toLowerCase();

    // 1. JSON formatting
    if (ext === 'json' || cleanMode.includes('json')) {
        try {
            const parsed = JSON.parse(content);
            return {
                success: true,
                formatted: JSON.stringify(parsed, null, 2),
            };
        } catch (e: any) {
            return {
                success: false,
                formatted: content,
                error: `Invalid JSON: ${e?.message || 'Syntax error'}`,
            };
        }
    }

    // 2. XML / HTML formatting
    if (['xml', 'html', 'svg'].includes(ext) || cleanMode.includes('xml') || cleanMode.includes('html')) {
        try {
            let formatted = '';
            let indent = 0;
            const tab = '  ';
            const lines = content.replace(/>\s*</g, '><').replace(/></g, '>\n<').split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                if (line.match(/^<\/\w/)) {
                    // Closing tag
                    if (indent > 0) indent--;
                }

                formatted += tab.repeat(indent) + line + '\n';

                if (line.match(/^<\w[^>]*[^\/]>.*$/) && !line.match(/^<\w[^>]*>.*<\/\w+>/)) {
                    // Opening tag (not self-closing and not single-line closed)
                    indent++;
                }
            }

            return {
                success: true,
                formatted: formatted.trimEnd(),
            };
        } catch (e: any) {
            return {
                success: false,
                formatted: content,
                error: `XML formatting failed: ${e?.message || 'Error'}`,
            };
        }
    }

    // 3. Properties / INI / Env formatting
    if (['properties', 'ini', 'env', 'cfg', 'conf'].includes(ext) || cleanMode.includes('properties') || cleanMode.includes('ini')) {
        const lines = content.split('\n');
        const formattedLines = lines.map((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
                return trimmed;
            }
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex).trim();
                const val = trimmed.substring(eqIndex + 1).trim();
                return `${key}=${val}`;
            }
            return trimmed;
        });

        return {
            success: true,
            formatted: formattedLines.join('\n'),
        };
    }

    // 4. YAML / Plaintext / General formatting: normalize indentation & trim trailing spaces
    const lines = content.split('\n');
    const cleanedLines = lines.map((line) => line.trimEnd());
    return {
        success: true,
        formatted: cleanedLines.join('\n').trimEnd() + '\n',
    };
};
