import base64

with open(r'c:\Users\ttt79\.antigravity-mods\dist\payload.zip', 'rb') as f:
    b64_data = base64.b64encode(f.read()).decode('ascii')

with open(r'c:\Users\ttt79\.antigravity-mods\dist\install.sh', 'r', encoding='utf-8') as f:
    orig = f.read()

# Replace extraction with embedded extractor
extractor_func = '''extract_embedded_payload() {
    echo "[*] Распаковка вшитых модулей в $MODS_DIR..."
    TMP_ZIP="$MODS_DIR/embedded_payload.zip"
    
    sed -n '/^__PAYLOAD_BEGIN__$/,/^__PAYLOAD_END__$/p' "$0" | grep -v '^__PAYLOAD_' | base64 -d > "$TMP_ZIP"

    if [ ! -s "$TMP_ZIP" ]; then
        echo -e "\\033[31m[-] Ошибка декодирования встроенного архива.\\033[0m"
        return 1
    fi

    if command -v unzip >/dev/null 2>&1; then
        unzip -q -o "$TMP_ZIP" -d "$MODS_DIR"
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "import zipfile; zipfile.ZipFile('$TMP_ZIP').extractall('$MODS_DIR')"
    elif command -v node >/dev/null 2>&1; then
        node -e "
          const cp = require('child_process');
          try { cp.execSync('unzip -q -o \\"$TMP_ZIP\\" -d \\"$MODS_DIR\\"'); } catch(_) {}
        "
    fi

    rm -f "$TMP_ZIP"
}
'''

# Find extraction block in orig
import re
# Insert extract_embedded_payload before do_install
orig = orig.replace('do_install() {', extractor_func + '\ndo_install() {\n')

# Inside do_install, replace zip extraction
old_zip_block_pattern = re.compile(r'    # Распаковка payload\.zip.*?# Проверка, что auto-patcher\.js', re.DOTALL)
orig = old_zip_block_pattern.sub('    extract_embedded_payload\n\n    # Проверка, что auto-patcher.js', orig)

# Append payload at end
full = orig.rstrip() + '\nexit 0\n\n__PAYLOAD_BEGIN__\n' + b64_data + '\n__PAYLOAD_END__\n'
full = full.replace('\r\n', '\n')

with open(r'c:\Users\ttt79\.antigravity-mods\dist\install.sh', 'w', encoding='utf-8', newline='\n') as f:
    f.write(full)

with open(r'C:\Users\ttt79\Downloads\install.sh', 'w', encoding='utf-8', newline='\n') as f:
    f.write(full)

print('Success! Self-contained install.sh size:', len(full))
