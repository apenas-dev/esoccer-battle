/**
 * SetupError - Structured error type for the setup system
 * Shared between main, preload, and renderer processes
 * Follows SOLID + KISS + camelCase
 */

// ─── Error Codes ─────────────────────────────────────────────────────────────

export type SetupErrorCode =
    | 'PYTHON_NOT_FOUND'
    | 'PYTHON_EMBEDDED_MISSING'
    | 'DEPS_MISSING'
    | 'DEPS_IMPORT_FAIL'
    | 'BACKEND_NOT_FOUND'
    | 'BACKEND_CRASH'
    | 'BACKEND_TIMEOUT'
    | 'BACKEND_HEALTH_FAIL'
    | 'MODEL_DOWNLOAD_FAIL'
    | 'MODEL_DOWNLOAD_TIMEOUT'
    | 'NETWORK_OFFLINE'
    | 'DISK_FULL'
    | 'UNKNOWN';

export type SetupErrorCategory =
    | 'python'
    | 'dependencies'
    | 'backend'
    | 'network'
    | 'models'
    | 'system';

// ─── Recovery Actions ────────────────────────────────────────────────────────

export interface RecoveryAction {
    id: 'retry' | 'open_logs' | 'reinstall' | 'check_network' | 'install_deps' | 'restart_app';
    label: string;
    variant: 'primary' | 'secondary';
}

// ─── SetupError ──────────────────────────────────────────────────────────────

export interface SetupError {
    code: SetupErrorCode;
    message: string;
    details?: string;
    category: SetupErrorCategory;
    recoveryActions: RecoveryAction[];
}

// ─── Error Code → Friendly Title ─────────────────────────────────────────────

const errorTitles: Record<SetupErrorCode, string> = {
    PYTHON_NOT_FOUND: 'Python Não Encontrado',
    PYTHON_EMBEDDED_MISSING: 'Python Embutido Ausente',
    DEPS_MISSING: 'Dependências Faltando',
    DEPS_IMPORT_FAIL: 'Dependência Não Carrega',
    BACKEND_NOT_FOUND: 'Backend Não Encontrado',
    BACKEND_CRASH: 'Backend Parou Inesperadamente',
    BACKEND_TIMEOUT: 'Backend Não Respondeu',
    BACKEND_HEALTH_FAIL: 'Backend Com Problemas',
    MODEL_DOWNLOAD_FAIL: 'Falha no Download do Modelo',
    MODEL_DOWNLOAD_TIMEOUT: 'Download Demorou Demais',
    NETWORK_OFFLINE: 'Sem Conexão com a Internet',
    DISK_FULL: 'Disco Cheio',
    UNKNOWN: 'Erro Desconhecido',
};

export function getErrorTitle(code: SetupErrorCode): string {
    return errorTitles[code] || 'Erro';
}

// ─── Error Code → Category ──────────────────────────────────────────────────

const errorCategories: Record<SetupErrorCode, SetupErrorCategory> = {
    PYTHON_NOT_FOUND: 'python',
    PYTHON_EMBEDDED_MISSING: 'python',
    DEPS_MISSING: 'dependencies',
    DEPS_IMPORT_FAIL: 'dependencies',
    BACKEND_NOT_FOUND: 'backend',
    BACKEND_CRASH: 'backend',
    BACKEND_TIMEOUT: 'backend',
    BACKEND_HEALTH_FAIL: 'backend',
    MODEL_DOWNLOAD_FAIL: 'models',
    MODEL_DOWNLOAD_TIMEOUT: 'models',
    NETWORK_OFFLINE: 'network',
    DISK_FULL: 'system',
    UNKNOWN: 'system',
};

// ─── Factory ─────────────────────────────────────────────────────────────────

const ACTION_RETRY: RecoveryAction = { id: 'retry', label: 'Tentar Novamente', variant: 'primary' };
const ACTION_OPEN_LOGS: RecoveryAction = { id: 'open_logs', label: 'Abrir Logs', variant: 'secondary' };
const ACTION_REINSTALL: RecoveryAction = { id: 'reinstall', label: 'Reinstalar App', variant: 'secondary' };
const ACTION_CHECK_NET: RecoveryAction = { id: 'check_network', label: 'Verificar Conexão', variant: 'secondary' };
const ACTION_INSTALL_DEPS: RecoveryAction = { id: 'install_deps', label: 'Instalar Dependências', variant: 'primary' };
const ACTION_RESTART: RecoveryAction = { id: 'restart_app', label: 'Reiniciar App', variant: 'primary' };

/**
 * Build recovery actions based on error code and platform.
 */
function buildRecoveryActions(code: SetupErrorCode, isWindows: boolean): RecoveryAction[] {
    switch (code) {
        case 'PYTHON_NOT_FOUND':
        case 'PYTHON_EMBEDDED_MISSING':
            return isWindows
                ? [ACTION_REINSTALL, ACTION_OPEN_LOGS]
                : [ACTION_INSTALL_DEPS, ACTION_OPEN_LOGS];

        case 'DEPS_MISSING':
        case 'DEPS_IMPORT_FAIL':
            return isWindows
                ? [ACTION_REINSTALL, ACTION_OPEN_LOGS]
                : [ACTION_INSTALL_DEPS, ACTION_OPEN_LOGS];

        case 'BACKEND_NOT_FOUND':
            return [ACTION_REINSTALL, ACTION_OPEN_LOGS];

        case 'BACKEND_CRASH':
            return [ACTION_RETRY, ACTION_OPEN_LOGS];

        case 'BACKEND_TIMEOUT':
        case 'BACKEND_HEALTH_FAIL':
            return [ACTION_RETRY, ACTION_OPEN_LOGS];

        case 'MODEL_DOWNLOAD_FAIL':
        case 'MODEL_DOWNLOAD_TIMEOUT':
            return [ACTION_RETRY, ACTION_CHECK_NET];

        case 'NETWORK_OFFLINE':
            return [ACTION_CHECK_NET, ACTION_RETRY];

        case 'DISK_FULL':
            return [ACTION_OPEN_LOGS];

        case 'UNKNOWN':
        default:
            return [ACTION_RESTART, ACTION_OPEN_LOGS];
    }
}

/**
 * Create a SetupError with auto-resolved category and recovery actions.
 */
export function createSetupError(
    code: SetupErrorCode,
    message: string,
    details?: string,
    isWindows = false,
): SetupError {
    return {
        code,
        message,
        details,
        category: errorCategories[code],
        recoveryActions: buildRecoveryActions(code, isWindows),
    };
}

// ─── Error Code → Category Icon (for UI) ────────────────────────────────────

const categoryIcons: Record<SetupErrorCategory, string> = {
    python: '🐍',
    dependencies: '📦',
    backend: '⚙️',
    network: '🌐',
    models: '🧠',
    system: '💻',
};

export function getCategoryIcon(category: SetupErrorCategory): string {
    return categoryIcons[category] || '❌';
}
