# 📦 E-Soccer Battle - Guia de Distribuição

## Executáveis Gerados

### Linux

| Arquivo | Tamanho | Formato |
|---------|---------|---------|
| `E-Soccer Battle-0.1.0.AppImage` | ~107 MB | Universal Linux |
| `esoccer-battle_0.1.0_amd64.deb` | ~106 MB | Debian/Ubuntu |

### Windows

⚠️ **Nota:** O build para Windows requer ser executado em uma máquina Windows devido às dependências nativas (better-sqlite3).

---

## 📥 Como Usar

### AppImage (Recomendado para Linux)

```bash
# 1. Dar permissão de execução
chmod +x "E-Soccer Battle-0.1.0.AppImage"

# 2. Executar
./E-Soccer\ Battle-0.1.0.AppImage

# Ou criar pasta portável para configurações
./E-Soccer\ Battle-0.1.0.AppImage --appimage-portable-home
```

**Vantagens:**
- Funciona em qualquer distribuição Linux
- Não requer instalação
- Portátil (pode rodar de pendrive)

### DEB (Debian/Ubuntu)

```bash
# 1. Instalar
sudo dpkg -i esoccer-battle_0.1.0_amd64.deb

# 2. Instalar dependências (se houver erros)
sudo apt-get install -f

# 3. Executar (do menu ou terminal)
esoccer-battle

# Para remover
sudo apt remove esoccer-battle
```

**Dependências instaladas automaticamente:**
- python3
- python3-pip
- python3-venv

---

## 🔧 Como Gerar os Executáveis

### Linux

```bash
cd apps/desktop

# Instalar dependências
npm install

# Gerar build
npm run build

# Gerar executáveis Linux
npx electron-builder --linux
```

### Windows (em máquina Windows)

```powershell
cd apps\desktop

# Instalar dependências
npm install

# Gerar build
npm run build

# Gerar executável Windows
npx electron-builder --win
```

**Arquivos gerados Windows:**
- `E-Soccer Battle Setup 0.1.0.exe` - Instalador NSIS
- `E-Soccer Battle-0.1.0-portable.exe` - Versão portátil

---

## 🐍 Backend Python

O aplicativo inclui o backend Python (voice-engine) como recurso extra. O usuário precisa:

### Primeira Execução

1. Instalar Python 3.10+ (se não instalado)
2. Criar ambiente virtual:
```bash
cd ~/.config/esoccer-battle/voice-engine
python3 -m venv venv
source venv/bin/activate  # Linux
# ou venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

3. O aplicativo tentará iniciar o backend automaticamente na porta 8001

### Verificar Backend

O app mostra status da conexão com backend na barra inferior:
- 🟢 Verde: Backend conectado
- 🔴 Vermelho: Backend offline

---

## 📁 Estrutura do Release

```
release/
├── E-Soccer Battle-0.1.0.AppImage  # Linux universal
├── esoccer-battle_0.1.0_amd64.deb  # Debian/Ubuntu
├── linux-unpacked/                  # Versão descompactada
│   ├── e-soccer-battle              # Executável principal
│   └── resources/
│       └── voice-engine/            # Backend Python
└── builder-debug.yml                # Log do build
```

---

## 🔄 CI/CD (GitHub Actions)

Para automatizar builds multiplataforma, adicione `.github/workflows/release.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
        working-directory: apps/desktop
      - run: npx electron-builder --linux
        working-directory: apps/desktop
      - uses: actions/upload-artifact@v4
        with:
          name: linux-builds
          path: apps/desktop/release/*.AppImage

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
        working-directory: apps/desktop
      - run: npx electron-builder --win
        working-directory: apps/desktop
      - uses: actions/upload-artifact@v4
        with:
          name: windows-builds
          path: apps/desktop/release/*.exe
```

---

## 📝 Versão

- **Versão atual:** 0.1.0
- **Electron:** 28.3.3
- **Data do build:** $(date +%Y-%m-%d)

---

## ⚠️ Limitações Conhecidas

1. **Windows Cross-Compilation:** Não é possível gerar .exe a partir do Linux devido ao módulo nativo `better-sqlite3`
2. **Tamanho:** ~100MB devido ao Electron e modelo Python incluídos
3. **Backend:** O backend Python precisa ser configurado na primeira execução

---

## 📞 Suporte

Para problemas com instalação ou execução:
1. Verifique se Python 3.10+ está instalado
2. Verifique os logs em `~/.config/esoccer-battle/logs/`
3. Teste o backend manualmente: `curl http://localhost:8001/health`
