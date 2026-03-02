/**
 * prepare-python.js
 *
 * Build-time script that downloads a standalone Python distribution
 * (from python-build-standalone) and installs all voice-engine
 * dependencies into it. The result is a self-contained python-standalone/
 * directory ready to be bundled by electron-builder.
 *
 * Usage: node scripts/prepare-python.js [--force]
 *   --force  Re-download and re-install even if python-standalone/ exists
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, createWriteStream, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { get as httpsGet } from 'https';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Configuration ───────────────────────────────────────────────────────────
const PYTHON_VERSION = '3.10.19';
const RELEASE_TAG = '20260211';
const ARCHIVE_NAME = `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-x86_64-pc-windows-msvc-install_only.tar.gz`;
const DOWNLOAD_URL = `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_TAG}/${ARCHIVE_NAME}`;

const DESKTOP_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(DESKTOP_DIR, 'python-standalone');
const TEMP_DIR = join(DESKTOP_DIR, '.python-download-tmp');
const VOICE_ENGINE_DIR = join(DESKTOP_DIR, '..', '..', 'backend', 'voice-engine');
const REQUIREMENTS_FILE = join(VOICE_ENGINE_DIR, 'requirements.txt');

// After extraction, python-build-standalone puts files under python/
const PYTHON_EXE = join(OUTPUT_DIR, 'python', 'python.exe');
const PIP_CMD = `"${PYTHON_EXE}" -m pip`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
    console.log(`[prepare-python] ${msg}`);
}

function logError(msg) {
    console.error(`[prepare-python] ERROR: ${msg}`);
}

/**
 * Download a file from a URL following redirects (GitHub releases redirect).
 */
function downloadFile(url, destPath, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            return reject(new Error('Too many redirects'));
        }

        const file = createWriteStream(destPath);

        httpsGet(url, (response) => {
            // Follow redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                file.close();
                rmSync(destPath, { force: true });
                log(`  Redirecting to: ${response.headers.location.substring(0, 80)}...`);
                return downloadFile(response.headers.location, destPath, maxRedirects - 1)
                    .then(resolve)
                    .catch(reject);
            }

            if (response.statusCode !== 200) {
                file.close();
                rmSync(destPath, { force: true });
                return reject(new Error(`Download failed with status ${response.statusCode}`));
            }

            const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedBytes = 0;
            let lastPercent = -1;

            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes > 0) {
                    const percent = Math.floor((downloadedBytes / totalBytes) * 100);
                    if (percent % 10 === 0 && percent !== lastPercent) {
                        lastPercent = percent;
                        log(`  Download: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
                    }
                }
            });

            pipeline(response, file)
                .then(() => {
                    log(`  Download complete: ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB`);
                    resolve();
                })
                .catch(reject);
        }).on('error', (err) => {
            file.close();
            rmSync(destPath, { force: true });
            reject(err);
        });
    });
}

/**
 * Extract a .tar.gz archive using the system `tar` command.
 * Works on Windows (tar is built-in since Windows 10 1803), Linux, and macOS.
 */
function extractTarGz(archivePath, destDir) {
    mkdirSync(destDir, { recursive: true });
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, {
        stdio: 'inherit',
        timeout: 300000, // 5 min
    });
}

/**
 * Run a pip command with standardised env and logging.
 * Returns true if the command succeeded, false otherwise.
 */
function runPip(args, { throwOnError = true, timeoutMs = 600000 } = {}) {
    const cmd = `${PIP_CMD} ${args}`;
    log(`  > ${cmd}`);
    try {
        execSync(cmd, {
            stdio: 'inherit',
            timeout: timeoutMs,
            cwd: VOICE_ENGINE_DIR,
            env: {
                ...process.env,
                PIP_NO_INPUT: '1',
                PYTHON_KEYRING_BACKEND: 'keyring.backends.null.Keyring',
            },
        });
        return true;
    } catch (err) {
        if (throwOnError) {
            throw err;
        }
        logError(`pip command failed: ${err.message}`);
        return false;
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const forceFlag = process.argv.includes('--force');

    log('=== Standalone Python Preparation ===');
    log('');
    log('── System Info ──');
    log(`  OS:       ${os.platform()} ${os.release()} (${os.arch()})`);
    log(`  Node:     ${process.version}`);
    log(`  CWD:      ${process.cwd()}`);
    log(`  Free RAM: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB`);
    try {
        const diskInfo = execSync('wmic logicaldisk get size,freespace,caption', { encoding: 'utf8', timeout: 5000 }).trim();
        log(`  Disk:\n    ${diskInfo.split('\n').join('\n    ')}`);
    } catch { log('  Disk: (could not query)'); }
    log('');
    log('── Configuration ──');
    log(`  Python version:  ${PYTHON_VERSION}`);
    log(`  Release tag:     ${RELEASE_TAG}`);
    log(`  Archive:         ${ARCHIVE_NAME}`);
    log(`  Download URL:    ${DOWNLOAD_URL}`);
    log(`  Output dir:      ${OUTPUT_DIR}`);
    log(`  Voice engine:    ${VOICE_ENGINE_DIR}`);
    log(`  Requirements:    ${REQUIREMENTS_FILE}`);
    log(`  Requirements exists: ${existsSync(REQUIREMENTS_FILE)}`);
    log(`  Voice engine exists: ${existsSync(VOICE_ENGINE_DIR)}`);
    log('');

    // Check if already prepared
    if (existsSync(PYTHON_EXE) && !forceFlag) {
        log('Python standalone already exists. Use --force to re-download.');
        log('Verifying pip works...');
        try {
            execSync(`${PIP_CMD} --version`, { stdio: 'pipe', timeout: 15000 });
            log('pip OK. Skipping download.');

            // Still ensure deps are installed
            await installDependencies();
            return;
        } catch {
            log('pip not working, re-downloading...');
        }
    }

    // Clean up
    if (existsSync(OUTPUT_DIR)) {
        log('Removing existing python-standalone/...');
        rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }

    // Create temp dir for download
    mkdirSync(TEMP_DIR, { recursive: true });

    const archivePath = join(TEMP_DIR, ARCHIVE_NAME);

    // Step 1: Download
    if (existsSync(archivePath) && !forceFlag) {
        log('Archive already downloaded, skipping download.');
    } else {
        log(`Downloading Python standalone from:`);
        log(`  ${DOWNLOAD_URL}`);
        await downloadFile(DOWNLOAD_URL, archivePath);
    }

    // Step 2: Extract
    log('Extracting archive...');
    extractTarGz(archivePath, OUTPUT_DIR);

    // List extracted contents for debugging
    log('── Extracted directory structure (top-level) ──');
    try {
        const topLevel = readdirSync(OUTPUT_DIR);
        topLevel.forEach(f => log(`  ${OUTPUT_DIR}/${f}`));
        if (existsSync(join(OUTPUT_DIR, 'python'))) {
            const pythonDir = readdirSync(join(OUTPUT_DIR, 'python')).slice(0, 20);
            pythonDir.forEach(f => log(`  ${OUTPUT_DIR}/python/${f}`));
            if (pythonDir.length >= 20) log('  ... (truncated)');
        } else {
            logError('  WARNING: python/ subdirectory not found after extraction!');
            const allDirs = topLevel.filter(f => {
                try { return readdirSync(join(OUTPUT_DIR, f)).length > 0; } catch { return false; }
            });
            log(`  Subdirectories found: ${allDirs.join(', ')}`);
        }
    } catch (e) { logError(`  Could not list extracted dir: ${e.message}`); }

    // Verify extraction
    if (!existsSync(PYTHON_EXE)) {
        logError(`Python executable not found at expected path: ${PYTHON_EXE}`);
        logError('Archive structure may have changed. Check contents of python-standalone/');
        process.exit(1);
    }

    log('Python extracted successfully.');

    // Step 3: Verify pip
    log('Verifying pip...');
    try {
        const pipVersion = execSync(`${PIP_CMD} --version`, { encoding: 'utf8', timeout: 15000 });
        log(`pip: ${pipVersion.trim()}`);
    } catch (err) {
        logError(`pip not available: ${err.message}`);
        log('Attempting to bootstrap pip with ensurepip...');
        try {
            execSync(`"${PYTHON_EXE}" -m ensurepip --upgrade`, { stdio: 'inherit', timeout: 60000 });
            log('ensurepip succeeded.');
        } catch (err2) {
            logError(`ensurepip failed: ${err2.message}`);
            process.exit(1);
        }
    }

    // Step 4: Upgrade pip + install wheel/setuptools
    log('Upgrading pip, wheel, setuptools...');
    runPip('install --upgrade pip wheel setuptools', { throwOnError: false, timeoutMs: 120000 });

    // Step 5: Install dependencies
    await installDependencies();

    // Step 6: Clean up download temp
    log('Cleaning up temp files...');
    rmSync(TEMP_DIR, { recursive: true, force: true });

    log('=== Done! Python standalone is ready for bundling. ===');
}

async function installDependencies() {
    if (!existsSync(REQUIREMENTS_FILE)) {
        logError(`requirements.txt not found at: ${REQUIREMENTS_FILE}`);
        process.exit(1);
    }

    // Show requirements contents for diagnostics
    log('── requirements.txt contents ──');
    try {
        const reqContent = readFileSync(REQUIREMENTS_FILE, 'utf8');
        reqContent.split('\n').forEach(line => log(`  ${line}`));
    } catch (e) { logError(`  Could not read: ${e.message}`); }
    log('');

    log(`Installing dependencies from ${REQUIREMENTS_FILE}...`);
    log('This may take several minutes (torch, faster-whisper, etc.)...');

    // ── Phase 1: Install native packages with --only-binary ──────────────
    // These packages have C/C++ extensions — we MUST use pre-compiled wheels.
    // If no wheel exists for this Python version + platform, pip will fail
    // fast instead of attempting (and failing) to compile from source.
    log('');
    log('── Phase 1: Installing native packages (binary-only) ──');
    const nativePackages = [
        'numpy',
        'ctranslate2',
        'faster-whisper>=1.0.0',
        'torch>=2.0.0',
        'torchaudio>=2.0.0',
        'soundfile>=0.12.1',
    ];

    try {
        runPip(
            `install --only-binary=:all: --verbose ${nativePackages.join(' ')}`,
            { timeoutMs: 1200000 } // 20 min (torch is large)
        );
        log('Phase 1 complete: native packages installed.');
    } catch (err) {
        logError(`Phase 1 failed: ${err.message}`);
        logError('');
        logError('Pre-compiled wheels are not available for');
        logError(`Python ${PYTHON_VERSION} on Windows x86_64. Possible fixes:`);
        logError('  1. Try a different Python version (e.g. 3.11, 3.12)');
        logError('  2. Pin ctranslate2 to a version with Windows wheels');
        logError('  3. Check https://pypi.org/project/ctranslate2/#files');
        process.exit(1);
    }

    // ── Phase 2: Install remaining (pure-Python) packages ────────────────
    log('');
    log('── Phase 2: Installing remaining packages from requirements.txt ──');
    try {
        runPip(
            `install --prefer-binary -r "${REQUIREMENTS_FILE}"`,
            { timeoutMs: 600000 } // 10 min
        );
        log('Phase 2 complete: all packages installed.');
    } catch (err) {
        logError(`Phase 2 (requirements.txt) failed: ${err.message}`);
        process.exit(1);
    }

    // ── Phase 3: List installed packages for debugging ───────────────────
    log('');
    log('── Installed packages ──');
    runPip('list --format=columns', { throwOnError: false, timeoutMs: 15000 });

    // ── Phase 4: Verify critical dependencies ────────────────────────────
    log('');
    log('── Verifying critical dependencies (import test) ──');
    const criticalDeps = ['fastapi', 'uvicorn', 'numpy', 'ctranslate2', 'faster_whisper', 'torch', 'soundfile', 'pydub'];

    let allOk = true;
    for (const dep of criticalDeps) {
        try {
            const output = execSync(`"${PYTHON_EXE}" -c "import ${dep}; print('${dep}', getattr(${dep}, '__version__', 'OK'))"`, {
                encoding: 'utf8',
                timeout: 30000,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            log(`  ✓ ${output.trim()}`);
        } catch (err) {
            const stderr = err.stderr ? err.stderr.toString().trim() : '';
            const stdout = err.stdout ? err.stdout.toString().trim() : '';
            logError(`  ✗ ${dep} — FAILED TO IMPORT`);
            if (stdout) {
                logError(`    [stdout] ${stdout}`);
            }
            if (stderr) {
                // Show full traceback, not just last 3 lines
                logError(`    [stderr]`);
                stderr.split('\n').forEach(line => logError(`      ${line}`));
            }
            allOk = false;
        }
    }

    if (!allOk) {
        logError('');
        logError('One or more critical dependencies failed to import.');
        logError('The build cannot continue. Check the errors above.');
        process.exit(1);
    }

    log('');
    log('All critical dependencies verified successfully.');
}

main().catch((err) => {
    logError(err.message);
    process.exit(1);
});
