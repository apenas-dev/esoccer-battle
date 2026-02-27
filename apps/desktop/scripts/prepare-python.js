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
import { existsSync, mkdirSync, rmSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { get as httpsGet } from 'https';

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

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const forceFlag = process.argv.includes('--force');

    log('=== Standalone Python Preparation ===');
    log(`Python version: ${PYTHON_VERSION}`);
    log(`Release: ${RELEASE_TAG}`);
    log(`Output dir: ${OUTPUT_DIR}`);

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

    // Step 4: Upgrade pip
    log('Upgrading pip...');
    try {
        execSync(`${PIP_CMD} install --upgrade pip`, {
            stdio: 'inherit',
            timeout: 120000,
            env: { ...process.env, PIP_NO_INPUT: '1' },
        });
    } catch {
        log('pip upgrade failed (continuing anyway)');
    }

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

    log(`Installing dependencies from ${REQUIREMENTS_FILE}...`);
    log('This may take several minutes (torch, faster-whisper, etc.)...');

    try {
        execSync(
            `${PIP_CMD} install --prefer-binary -r "${REQUIREMENTS_FILE}"`,
            {
                stdio: 'inherit',
                timeout: 1800000, // 30 min (torch is large)
                cwd: VOICE_ENGINE_DIR,
                env: {
                    ...process.env,
                    PIP_NO_INPUT: '1',
                    PYTHON_KEYRING_BACKEND: 'keyring.backends.null.Keyring',
                },
            }
        );
        log('Dependencies installed successfully.');
    } catch (err) {
        logError(`pip install failed: ${err.message}`);
        logError('You may need to run this script again or install dependencies manually.');
        process.exit(1);
    }

    // Verify critical dependencies
    log('Verifying critical dependencies...');
    const criticalDeps = ['fastapi', 'uvicorn', 'numpy', 'faster_whisper'];
    for (const dep of criticalDeps) {
        try {
            execSync(`"${PYTHON_EXE}" -c "import ${dep}; print('${dep} OK')"`, {
                stdio: 'pipe',
                timeout: 15000,
            });
            log(`  ✓ ${dep}`);
        } catch {
            logError(`  ✗ ${dep} - FAILED TO IMPORT`);
            process.exit(1);
        }
    }

    log('All critical dependencies verified.');
}

main().catch((err) => {
    logError(err.message);
    process.exit(1);
});
