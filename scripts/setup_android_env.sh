#!/usr/bin/env bash
# Task 38 — Reconstruction reproductible de l'environnement de build Android
# (sandbox recyclée : .jdk21/ et .android-sdk/ ont disparu).
# Idempotent : chaque étape est sautée si son artefact existe déjà.
# Outils installés DANS le projet (gitignés) — pas de sudo disponible.
set -euo pipefail

ROOT="/home/z/my-project"
SDK="$ROOT/.android-sdk"
JDK="$ROOT/.jdk21"
mkdir -p "$SDK" "$JDK"

echo "=== [1/4] JDK 21 (Temurin, eclipse-adoptium) ==="
if [ -x "$JDK/bin/javac" ]; then
    echo "JDK déjà présent : $($JDK/bin/javac -version 2>&1)"
else
    echo "Téléchargement Temurin 21 (linux x64)…"
    curl -fsSL -o /tmp/jdk21.tar.gz \
        "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
    tar -xzf /tmp/jdk21.tar.gz -C "$JDK" --strip-components=1
    rm -f /tmp/jdk21.tar.gz
    echo "JDK installé : $($JDK/bin/javac -version 2>&1)"
fi
export JAVA_HOME="$JDK"
export PATH="$JDK/bin:$PATH"

echo "=== [2/4] Android cmdline-tools ==="
if [ -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
    echo "cmdline-tools déjà présent"
else
    echo "Téléchargement commandlinetools-linux-11076708…"
    curl -fsSL -o /tmp/clt.zip \
        "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
    mkdir -p "$SDK/cmdline-tools"
    unzip -q -o /tmp/clt.zip -d "$SDK/cmdline-tools"
    mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"
    rm -f /tmp/clt.zip
    echo "cmdline-tools installés"
fi

echo "=== [3/4] Licences + paquets SDK (platform-tools, android-36, build-tools 36.0.0) ==="
yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" --licenses > /tmp/sdk_lic.log 2>&1 || true
if ! "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" \
    "platform-tools" "platforms;android-36" "build-tools;36.0.0" > /tmp/sdk_install.log 2>&1; then
    echo "ERREUR sdkmanager — extrait du log :" >&2
    tail -25 /tmp/sdk_install.log >&2
    exit 1
fi
tail -3 /tmp/sdk_install.log

echo "=== [4/4] local.properties ==="
if ! grep -q "sdk.dir" "$ROOT/android/local.properties" 2>/dev/null; then
    echo "sdk.dir=$SDK" > "$ROOT/android/local.properties"
fi
cat "$ROOT/android/local.properties"

echo "=== ENV PRÊT ==="
"$JDK/bin/java" -version 2>&1 | head -1
ls "$SDK"
